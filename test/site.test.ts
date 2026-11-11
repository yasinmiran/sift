import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { load } from "cheerio";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildSite } from "../src/site/build";
import { DROP_TIMES, RETIRE_FOR_SUBSCRIBER, RETIRE_NOTE, TIME_LEFT } from "../src/site/today";

let root: string;
let out: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "sift-site-"));
  out = join(root, "site");
  mkdirSync(join(root, "digests"), { recursive: true });
});
afterEach(() => {
  vi.useRealTimers();
});

const digest = (day: string, body: string) =>
  writeFileSync(
    join(root, "digests", `${day}.md`),
    `---\ntitle: "The day's tech, sifted: ${day}"\ndescription: "top story of ${day}"\ndate: "${day}"\n---\n\n${body}\n`,
  );

// The digest agent's carousel script for the day; only the slots matter here,
// since the pm one is what marks a day as rewritten in the evening.
const slides = (day: string, slots: ("am" | "pm")[]) => {
  mkdirSync(join(root, "data", "slides"), { recursive: true });
  writeFileSync(
    join(root, "data", "slides", `${day}.json`),
    JSON.stringify({
      day,
      posts: slots.map((slot) => ({
        slot,
        hook: "hook",
        caption: "full digest at sift.yasint.dev (link in bio)",
        hashtags: ["#ai"],
        slides: [
          { number: 1, category: "ai", title: "t", desc: "d", url: "https://example.com/a" },
        ],
      })),
    }),
  );
};

// The shell script never runs under vitest, so drive the real emitted source
// in a stand-in scope, the way test/sw.test.ts drives sw.js: `with` sends
// every bare identifier through the proxy, so a denied storage throws on the
// read itself rather than from a method, which is what safari's "block all
// cookies" and chrome's block-all-site-data actually do.
function runShell(html: string, denied: string[]) {
  const source = html
    .split(/<script[^>]*>/)
    .map((chunk) => chunk.split("</script>")[0]!)
    .find((chunk) => chunk.includes("sift-from"))!;
  const registered: string[] = [];
  const remembered: string[] = [];
  const link: { href: string | null } = { href: null };
  const bindings: Record<string, unknown> = {
    location: { search: "?from=/notes", reload: () => {} },
    sessionStorage: { getItem: () => "/earlier", setItem: (_k: string, v: string) => remembered.push(v) },
    document: { querySelector: () => link, addEventListener: () => {} },
    navigator: { serviceWorker: { register: (path: string) => registered.push(path) } },
    matchMedia: () => ({ matches: false }),
  };
  const scope = new Proxy(bindings, {
    has: () => true,
    get: (target, key) => {
      if (key === Symbol.unscopables) return undefined;
      if (denied.includes(String(key))) throw new Error("SecurityError: the operation is insecure");
      return key in target ? target[String(key)] : (globalThis as Record<string, unknown>)[String(key)];
    },
  });
  new Function("scope", `with (scope) {${source}}`)(scope);
  return { registered, remembered, href: link.href };
}

describe("buildSite", () => {
  it("renders an index newest-first and a page per digest", () => {
    digest("2026-07-03", "## Section\n\n- [story](https://example.com/a) why it matters");
    digest("2026-07-04", "## Later\n\ncontent");
    const { pages } = buildSite(root, out);
    expect(pages).toBe(3);
    const index = readFileSync(join(out, "index.html"), "utf8");
    expect(index.indexOf("2026-07-04")).toBeLessThan(index.indexOf("2026-07-03"));
    expect(index).toContain('href="2026-07-04.html"');
    expect(index).toContain("top story of 2026-07-03");
    const day = readFileSync(join(out, "2026-07-03.html"), "utf8");
    expect(day).toContain("<h2>Section</h2>");
    expect(day).toContain('href="https://example.com/a"');
    expect(day).toContain("The day&#39;s tech, sifted: 2026-07-03");
  });

  // The hero links its own description; the rows under it have to as well, or
  // the sentence a reader is looking at is the one part of the row that is not
  // the link. Asserted on the dom rather than on the string, since the only
  // thing that matters is which element the paragraph sits inside.
  it("makes every archived row's description part of its link", () => {
    for (const day of ["2026-07-02", "2026-07-03", "2026-07-04"]) digest(day, "body");
    buildSite(root, out);
    const $ = load(readFileSync(join(out, "index.html"), "utf8"));
    const rows = $(".days li");
    expect(rows.length).toBe(2);
    rows.each((_, li) => {
      expect($(li).find("a p.meta").length).toBe(1);
      expect($(li).children("p.meta").length).toBe(0);
    });
    expect($("a.hero p.desc").length).toBe(1);
  });

  it("escapes raw html instead of rendering it", () => {
    digest("2026-07-04", "hello <script>alert(1)</script> world");
    buildSite(root, out);
    const day = readFileSync(join(out, "2026-07-04.html"), "utf8");
    expect(day).not.toContain("<script>alert");
    expect(day).toContain("&lt;script&gt;");
  });

  it("renders an empty state when there are no digests", () => {
    const { pages } = buildSite(root, out);
    expect(pages).toBe(1);
    expect(readFileSync(join(out, "index.html"), "utf8")).toContain("nothing sifted yet");
  });

  // The archive is a rolling month, so days leave it, and a build that writes
  // into the previous build's output leaves their pages behind: served under
  // urls the index, the sitemap, the feed and the pager have all stopped
  // naming. Asserted as the invariant rather than as the symptom, by building
  // the same tree twice in two ways: into a directory a wider archive already
  // filled, and into a fresh one. The two have to come out identical, which
  // is the whole of "the built tree is a function of digests/ and public/".
  it("builds the same tree whether or not a wider archive built here first", () => {
    for (const day of ["2026-07-02", "2026-07-03", "2026-07-04"]) digest(day, "body");
    buildSite(root, out);
    expect(readdirSync(out).filter((f) => /^\d{4}-\d{2}-\d{2}\.html$/.test(f)).length).toBe(3);

    rmSync(join(root, "digests", "2026-07-02.md"));
    const { pages } = buildSite(root, out);
    const fresh = join(root, "fresh");
    buildSite(root, fresh);

    expect(pages).toBe(3);
    const tree = (d: string) =>
      readdirSync(d)
        .sort()
        .map((f) => `${f} ${readFileSync(join(d, f), "utf8").length}`);
    expect(tree(out)).toEqual(tree(fresh));
    expect(readdirSync(out)).not.toContain("2026-07-02.html");
    expect(readdirSync(out).filter((f) => /^\d{4}-\d{2}-\d{2}\.html$/.test(f)).length).toBe(2);
  });

  it("gives the index a today slot that redirects or reports the next drop", () => {
    digest("2026-07-03", "body");
    buildSite(root, out);
    const index = readFileSync(join(out, "index.html"), "utf8");
    expect(index).toContain('<section id="today" class="today-note" hidden></section>');
    expect(index).toContain('timeZone: "Europe/Oslo"');
    expect(index).toContain("location.replace");
    expect(index).toContain("dropAt(4, 45)");
    expect(index).toContain("dropAt(16, 45)");
    expect(index).toContain('"around " + AM_NEXT + " tomorrow"');
    const day = readFileSync(join(out, "2026-07-03.html"), "utf8");
    expect(day).not.toContain('id="today"');
  });

  // The two drop labels are Oslo wall clock, and Oslo moves an hour twice a
  // year while the built html sits still; they have to come from the UTC
  // schedule at view time, not from a literal baked in at build time.
  it("derives the drop times from the UTC schedule, so they hold across DST", () => {
    const read = () => new Function(`${DROP_TIMES}\nreturn [AM, PM, AM_NEXT];`)() as string[];
    vi.useFakeTimers();

    vi.setSystemTime(new Date("2026-09-09T08:00:00Z"));
    expect(read()).toEqual(["06:45", "18:45", "06:45"]);

    vi.setSystemTime(new Date("2026-12-15T08:00:00Z"));
    expect(read()).toEqual(["05:45", "17:45", "05:45"]);

    // Europe/Oslo leaves CEST on 2026-10-25: that evening, tomorrow's
    // morning drop is an hour earlier than today's was.
    vi.setSystemTime(new Date("2026-10-24T19:00:00Z"));
    expect(read()).toEqual(["06:45", "18:45", "05:45"]);
  });

  // The countdown is prose, so one hour is "an hour", not "1 hours". The
  // rounded hour is 1 for every gap from 61 to 89 minutes, which is the
  // half-hour before 17:45 Oslo on every morning-half day.
  it("counts the hours to the evening drop in words, one of them singular", () => {
    const timeLeft = new Function(`${TIME_LEFT}\nreturn timeLeft;`)() as (left: number) => string;
    expect(timeLeft(720)).toBe("in about 12 hours");
    expect(timeLeft(90)).toBe("in about 2 hours");
    expect(timeLeft(89)).toBe("in about an hour");
    expect(timeLeft(61)).toBe("in about an hour");
    expect(timeLeft(60)).toBe("in under an hour");
    expect(timeLeft(1)).toBe("in under an hour");
  });

  // Collapsing the note out of the flow above the digest moves `.prose` up
  // 169px, 0.1220 of layout shift at 390px wide, so it may only happen once
  // the note is off screen: there the browser (or the rAF below it) takes the
  // same 169px off the scroll offset and nothing a reader is looking at
  // moves. The gate is that invariant: the note never leaves the flow while
  // any of it is on screen.
  it("retires the half-day note only once it is scrolled out of view", () => {
    const retireWhenPast = new Function(
      `${RETIRE_NOTE}\nreturn retireWhenPast;`,
    )() as (slot: unknown, w: unknown) => void;

    const fakes = (bottom: number, scrollY = 0) => {
      const slot = { hidden: false, offsetHeight: 147, bottom, getBoundingClientRect: () => ({ bottom: slot.bottom }) };
      const w = {
        scrollY,
        frames: [] as (() => void)[],
        handlers: [] as (() => void)[],
        scrolledTo: null as number | null,
        getComputedStyle: () => ({ marginTop: "22.4px" }),
        requestAnimationFrame: (fn: () => void) => w.frames.push(fn),
        scrollTo: (_x: number, y: number) => {
          w.scrolledTo = y;
        },
        addEventListener: (_type: string, fn: () => void) => w.handlers.push(fn),
        removeEventListener: (_type: string, fn: () => void) => {
          w.handlers = w.handlers.filter((h) => h !== fn);
        },
      };
      return { slot, w };
    };

    // Already past the top edge: collapsed, and the vacated box (its height
    // plus its own margin) comes off the scroll offset in the frame before
    // the paint, so the line under the reader's eye does not move.
    const past = fakes(-1, 400);
    retireWhenPast(past.slot, past.w);
    expect(past.slot.hidden).toBe(true);
    expect(past.w.handlers).toHaveLength(0);
    expect(past.w.frames).toHaveLength(1);
    past.w.frames[0]!();
    expect(past.w.scrolledTo).toBe(400 - (147 + 22.4));

    // Scroll anchoring got there first: no second subtraction.
    const anchored = fakes(-1, 400);
    retireWhenPast(anchored.slot, anchored.w);
    anchored.w.scrollY = 231;
    anchored.w.frames[0]!();
    expect(anchored.w.scrolledTo).toBeNull();

    // On screen, and its exact bottom edge counts as on screen: nothing is
    // collapsed and a scroll listener waits. A scroll that leaves any of the
    // note showing collapses nothing; the one that clears it retires the note
    // and takes the listener with it.
    const onScreen = fakes(409);
    retireWhenPast(onScreen.slot, onScreen.w);
    expect(onScreen.slot.hidden).toBe(false);
    expect(onScreen.w.handlers).toHaveLength(1);

    onScreen.slot.bottom = 0.5;
    onScreen.w.scrollY = 408;
    onScreen.w.handlers[0]!();
    expect(onScreen.slot.hidden).toBe(false);
    expect(onScreen.w.handlers).toHaveLength(1);

    onScreen.slot.bottom = -0.5;
    onScreen.w.scrollY = 409;
    onScreen.w.handlers[0]!();
    expect(onScreen.slot.hidden).toBe(true);
    expect(onScreen.w.handlers).toHaveLength(0);
    onScreen.w.frames[0]!();
    expect(onScreen.w.scrolledTo).toBe(409 - (147 + 22.4));
  });

  // Both ways out of the note go through the gate above. A reduced-motion
  // reader skips the drain bar and nothing else: collapsing the note while it
  // is on screen is the 0.1227 shift (390px) #335 removed, and handing it to
  // the reader who asked for less movement is the one branch that still did.
  it("retires the subscribed reader's note on scroll in both motion modes", () => {
    const retireForSubscriber = new Function(
      `${RETIRE_NOTE}${RETIRE_FOR_SUBSCRIBER}\nreturn retireForSubscriber;`,
    )() as (slot: unknown, w: unknown, reduced: boolean) => void;

    // On screen, which is where a reader who has just opened the page is.
    const fakes = () => {
      const slot = {
        hidden: false,
        offsetHeight: 147,
        bottom: 409,
        classes: [] as string[],
        classList: { add: (c: string) => slot.classes.push(c) },
        getBoundingClientRect: () => ({ bottom: slot.bottom }),
      };
      const w = {
        scrollY: 0,
        frames: [] as (() => void)[],
        handlers: [] as (() => void)[],
        timers: [] as { fn: () => void; ms: number }[],
        getComputedStyle: () => ({ marginTop: "22.4px" }),
        requestAnimationFrame: (fn: () => void) => w.frames.push(fn),
        scrollTo: () => {},
        setTimeout: (fn: () => void, ms: number) => w.timers.push({ fn, ms }),
        addEventListener: (_type: string, fn: () => void) => w.handlers.push(fn),
        removeEventListener: (_type: string, fn: () => void) => {
          w.handlers = w.handlers.filter((h) => h !== fn);
        },
      };
      return { slot, w };
    };

    // Reduced motion: no drain class, no timer, and the note stays in the
    // flow with a scroll listener holding it there.
    const quiet = fakes();
    retireForSubscriber(quiet.slot, quiet.w, true);
    expect(quiet.slot.classes).toEqual([]);
    expect(quiet.w.timers).toHaveLength(0);
    expect(quiet.slot.hidden).toBe(false);
    expect(quiet.w.handlers).toHaveLength(1);
    quiet.slot.bottom = -0.5;
    quiet.w.scrollY = 409;
    quiet.w.handlers[0]!();
    expect(quiet.slot.hidden).toBe(true);

    // No preference: the drain bar runs first and the note is still in the
    // flow until the timer arms the same gate.
    const animated = fakes();
    retireForSubscriber(animated.slot, animated.w, false);
    expect(animated.slot.classes).toEqual(["draining"]);
    expect(animated.w.timers.map((t) => t.ms)).toEqual([6200]);
    expect(animated.w.handlers).toHaveLength(0);
    expect(animated.slot.hidden).toBe(false);
    animated.w.timers[0]!.fn();
    expect(animated.w.handlers).toHaveLength(1);
    expect(animated.slot.hidden).toBe(false);
    animated.slot.bottom = -0.5;
    animated.w.scrollY = 409;
    animated.w.handlers[0]!();
    expect(animated.slot.hidden).toBe(true);
  });

  it("carries the byline backlink and a github link in a shared footer", () => {
    digest("2026-07-04", "body");
    buildSite(root, out);
    const byline = '<span class="byline">by <a href="https://yasint.dev" data-backlink>yasin</a></span>';
    const index = readFileSync(join(out, "index.html"), "utf8");
    const day = readFileSync(join(out, "2026-07-04.html"), "utf8");
    expect(index).toContain("sift<span class=\"dot\">.</span></h1>");
    expect(day.indexOf(byline)).toBeGreaterThan(day.indexOf("</article>"));
    for (const html of [index, day]) {
      expect(html).toContain('class="foot"');
      expect(html).toContain(byline);
      expect(html).not.toContain('class="gh"');
      expect(html).toContain('class="foot-note"');
      expect(html).toContain('href="https://github.com/yasinmiran/sift/blob/main/AGENTS.md"');
      expect(html.indexOf('class="foot"')).toBeGreaterThan(html.indexOf("<h1>"));
      expect(html).toContain('sessionStorage.setItem("sift-from"');
      expect(html).toContain('"https://yasint.dev" + back');
    }
  });

  it("counts views via goatcounter and shows them on day pages only", () => {
    digest("2026-07-04", "body");
    buildSite(root, out);
    const index = readFileSync(join(out, "index.html"), "utf8");
    const day = readFileSync(join(out, "2026-07-04.html"), "utf8");
    for (const html of [index, day]) {
      expect(html).toContain('data-goatcounter="https://yasin.goatcounter.com/count"');
      expect(html).toContain("gc.zgo.at/count.js");
    }
    expect(day).toContain('id="views"');
    expect(day).toContain("yasin.goatcounter.com/counter/");
    expect(index).not.toContain('id="views"');
    // A page with one recorded view reads "1 view". The counter's own text is
    // written in the browser, so this pins the branch the script carries.
    expect(day).toContain('(n === "1" ? " view" : " views")');
  });

  it("emits seo head tags, sitemap, robots and copies public assets", () => {
    digest("2026-07-03", "body");
    digest("2026-07-04", "body");
    mkdirSync(join(root, "public", "favicons"), { recursive: true });
    writeFileSync(join(root, "public", "favicons", "favicon.svg"), "<svg/>");
    buildSite(root, out);

    const index = readFileSync(join(out, "index.html"), "utf8");
    expect(index).toContain('<link rel="canonical" href="https://sift.yasint.dev/">');
    expect(index).toContain('<meta property="og:type" content="website">');
    expect(index).toContain('<meta name="description"');
    expect(index).toContain('href="/favicons/favicon.svg"');
    expect(index).toContain('<meta property="og:image" content="https://sift.yasint.dev/og.png">');
    expect(index).toContain('<meta property="og:image:width" content="1200">');
    expect(index).toContain('<meta property="og:image:height" content="630">');
    expect(index).toContain('<meta name="twitter:card" content="summary_large_image">');
    expect(index).toContain('<meta name="twitter:image" content="https://sift.yasint.dev/og.png">');

    const day = readFileSync(join(out, "2026-07-04.html"), "utf8");
    expect(day).toContain('<link rel="canonical" href="https://sift.yasint.dev/2026-07-04.html">');
    expect(day).toContain('<meta property="og:type" content="article">');
    expect(day).toContain('content="top story of 2026-07-04"');

    expect(readFileSync(join(out, "favicons", "favicon.svg"), "utf8")).toBe("<svg/>");

    const map = readFileSync(join(out, "sitemap.xml"), "utf8");
    expect(map).toContain("<loc>https://sift.yasint.dev/</loc>");
    expect(map).toContain("<loc>https://sift.yasint.dev/2026-07-03.html</loc>");
    expect(map).not.toContain("404");
    expect(readFileSync(join(out, "robots.txt"), "utf8")).toContain(
      "Sitemap: https://sift.yasint.dev/sitemap.xml",
    );
  });

  it("loads the webfont stylesheet without blocking the first paint", () => {
    digest("2026-07-04", "body");
    buildSite(root, out);

    for (const file of ["index.html", "2026-07-04.html", "404.html"]) {
      const html = readFileSync(join(out, file), "utf8");
      expect(html).toContain('<link rel="preload" as="style" href="https://fonts.googleapis.com/css2?');
      expect(html).toContain("onload=\"this.rel='stylesheet'\"");
      // The only stylesheet link left is the noscript fallback; a bare one
      // outside it would put the third-party request back in front of paint.
      expect(html).toContain('<noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?');
      expect(html.match(/<link rel="stylesheet"/g)).toHaveLength(1);
    }
  });

  // The preload flip above buys the first paint and bills it as reflow: the
  // prose paints in the fallback and re-wraps when Karla lands, 137 to 330px
  // of movement on 16 of 16 day page readings before the metrics-matched
  // faces. So the stack has to name the fallback ahead of the generic
  // families, every face has to carry the four descriptors that make it
  // measure like Karla, and bold needs a face of its own: one face answers
  // weight 700 with the regular glyphs, which neither looks bold nor wraps
  // like bold.
  it("gives the fallback text karla's metrics so the swap re-wraps nothing", () => {
    digest("2026-07-04", "body");
    buildSite(root, out);

    for (const file of ["index.html", "2026-07-04.html", "404.html"]) {
      const html = readFileSync(join(out, file), "utf8");
      expect(html).toContain('font:400 1rem/1.6 "Karla","Karla fallback",ui-sans-serif');
      const faces = [...html.matchAll(/@font-face\{([^}]*)\}/g)]
        .map((m) => m[1]!)
        .filter((face) => face.includes('font-family:"Karla fallback"'));
      expect(faces.length, `${file}: no metrics-matched fallback face`).toBeGreaterThan(0);
      for (const face of faces) {
        expect(face, `${file}: fallback face loads something other than a local font`).toMatch(
          /src:local\(/,
        );
        for (const descriptor of [
          "size-adjust",
          "ascent-override",
          "descent-override",
          "line-gap-override",
        ]) {
          expect(face, `${file}: fallback face without ${descriptor}`).toContain(`${descriptor}:`);
        }
      }
      expect(
        faces.some((face) => face.includes("font-weight:700")),
        `${file}: no bold fallback face, so strong text renders at 400 until karla lands`,
      ).toBe(true);
    }
  });

  it("renders pen marks on day pages with the hand-drawn styles", () => {
    digest("2026-07-04", "a ==big deal== and ((circled)) figure");
    buildSite(root, out);
    const day = readFileSync(join(out, "2026-07-04.html"), "utf8");
    expect(day).toContain('<mark class="pen pen-u">big deal</mark>');
    expect(day).toContain('<mark class="pen pen-o">circled</mark>');
    expect(day).toContain("mark.pen{");
    expect(day).toContain(".pen-u{");
    expect(day).toContain(".pen-o{");
  });

  // A pen mark is a background image and nothing else, so both surfaces that
  // drop backgrounds (chrome prints them off by default, forced-colors
  // repaints to the reader's two colours) render the day's one marked phrase
  // as ordinary text. The fallback has to reach both media and has to carry
  // ink of its own, not merely clear the image it cannot paint.
  it("gives the pen marks ink that survives print and forced colors", () => {
    digest("2026-07-04", "a ==big deal== and ((circled)) figure");
    buildSite(root, out);
    for (const file of ["index.html", "2026-07-04.html"]) {
      const html = readFileSync(join(out, file), "utf8");
      const block = /@media print,\(forced-colors:active\)\{([^]*?)\n\}/.exec(html);
      expect(block, `${file}: no off-screen block for the pen marks`).not.toBeNull();
      const css = block?.[1] ?? "";
      for (const cls of ["pen-u", "pen-o"]) {
        const rule = new RegExp(`\\.${cls}\\{([^}]*)\\}`).exec(css)?.[1];
        expect(rule, `${file}: .${cls} has no off-screen fallback`).toBeDefined();
        expect(rule, `${file}: .${cls} keeps a background image where it cannot paint`).toContain(
          "background-image:none",
        );
        expect(rule, `${file}: .${cls} drops the scribble and draws nothing in its place`).toMatch(
          /border[^:]*:[^;]*currentColor/,
        );
      }
    }
  });

  it("lets a bare url in the prose break rather than widen the page", () => {
    digest(
      "2026-07-04",
      "Android 17 ships without an AOSP release (https://grapheneos.social/@GrapheneOS/117282080803799576) and the room noticed.",
    );
    buildSite(root, out);
    const day = readFileSync(join(out, "2026-07-04.html"), "utf8");
    // Both halves matter. A bare url has to reach the page as an anchor, since
    // the wrap rule is on .prose a; and the anchor has to be allowed to break
    // mid-token, since a url offers no break opportunity at / or . and 515px
    // of unbreakable link text widens the whole page on a 375px screen.
    expect(day).toContain(
      '<a href="https://grapheneos.social/@GrapheneOS/117282080803799576">https://grapheneos.social/@GrapheneOS/117282080803799576</a>',
    );
    expect(day).toMatch(/\.prose a\{[^}]*overflow-wrap:break-word/);
  });

  it("emits structured data for the site and each day", () => {
    digest("2026-07-04", "body");
    buildSite(root, out);
    const index = readFileSync(join(out, "index.html"), "utf8");
    expect(index).toContain('<script type="application/ld+json">');
    expect(index).toContain('"@type":"WebSite"');
    const day = readFileSync(join(out, "2026-07-04.html"), "utf8");
    expect(day).toContain('"@type":"NewsArticle"');
    expect(day).toContain('"datePublished":"2026-07-04T04:34:00Z"');
    expect(day).toContain('"headline":"The day\'s tech, sifted: 2026-07-04"');
    expect(day).toContain('<meta property="article:published_time" content="2026-07-04T04:34:00Z">');
    expect(index).not.toContain("article:published_time");
  });

  it("dates a day by the drop it belongs to, the same instant the feed publishes", () => {
    digest("2026-07-04", "body");
    buildSite(root, out);
    const day = readFileSync(join(out, "2026-07-04.html"), "utf8");
    const feed = readFileSync(join(out, "feed.xml"), "utf8");
    // The morning drop, said twice in one build: rss as an http-date, the
    // structured data as the same instant in ISO 8601.
    expect(feed).toContain("<pubDate>Sat, 04 Jul 2026 04:34:00 GMT</pubDate>");
    expect(day).toContain('"datePublished":"2026-07-04T04:34:00Z"');
    // No carousel at all, so nothing claims the page changed after it.
    expect(day).toContain('"dateModified":"2026-07-04T04:34:00Z"');
    expect(day).not.toContain("article:modified_time");
  });

  it("carries the evening drop as dateModified once the day has a pm carousel", () => {
    digest("2026-07-04", "body");
    slides("2026-07-04", ["am", "pm"]);
    buildSite(root, out);
    const day = readFileSync(join(out, "2026-07-04.html"), "utf8");
    expect(day).toContain('"datePublished":"2026-07-04T04:34:00Z"');
    expect(day).toContain('"dateModified":"2026-07-04T16:34:00Z"');
    expect(day).toContain('<meta property="article:modified_time" content="2026-07-04T16:34:00Z">');
  });

  it("dates a pm-only day by the evening drop it was published at", () => {
    // A day whose morning run was skipped gets its single post as pm and
    // never gets an am retroactively (AGENTS.md), so it went up once, in the
    // evening, and was not rewritten afterwards.
    digest("2026-07-04", "body");
    slides("2026-07-04", ["pm"]);
    buildSite(root, out);
    const day = readFileSync(join(out, "2026-07-04.html"), "utf8");
    expect(day).toContain('"datePublished":"2026-07-04T16:34:00Z"');
    expect(day).toContain('"dateModified":"2026-07-04T16:34:00Z"');
    expect(day).toContain('<meta property="article:published_time" content="2026-07-04T16:34:00Z">');
    expect(day).not.toContain("article:modified_time");
  });

  it("builds the page anyway when the day's carousel is unreadable", () => {
    digest("2026-07-04", "body");
    mkdirSync(join(root, "data", "slides"), { recursive: true });
    writeFileSync(join(root, "data", "slides", "2026-07-04.json"), "{ not json");
    expect(() => buildSite(root, out)).not.toThrow();
    const day = readFileSync(join(out, "2026-07-04.html"), "utf8");
    // Falls back to the morning drop; the broken file is verify.ts's to report.
    expect(day).toContain('"dateModified":"2026-07-04T04:34:00Z"');
  });

  it("moves the sitemap's lastmod to the evening drop when the day was rewritten", () => {
    digest("2026-07-03", "body");
    digest("2026-07-04", "body");
    slides("2026-07-04", ["am", "pm"]);
    buildSite(root, out);
    const map = readFileSync(join(out, "sitemap.xml"), "utf8");
    // lastmod is the recrawl signal, so the rewritten day has to carry the
    // instant it was rewritten at, and the index with it — its hero is that
    // day's description. The day nobody touched keeps its morning drop.
    expect(map).toContain(
      "<loc>https://sift.yasint.dev/2026-07-04.html</loc><lastmod>2026-07-04T16:34:00Z</lastmod>",
    );
    expect(map).toContain("<loc>https://sift.yasint.dev/</loc><lastmod>2026-07-04T16:34:00Z</lastmod>");
    expect(map).toContain(
      "<loc>https://sift.yasint.dev/2026-07-03.html</loc><lastmod>2026-07-03T04:34:00Z</lastmod>",
    );
    // The same instant the page head states: one build, one answer.
    expect(readFileSync(join(out, "2026-07-04.html"), "utf8")).toContain(
      '"dateModified":"2026-07-04T16:34:00Z"',
    );
  });

  it("publishes a pm-only day in the feed at the drop it went up, not the morning one", () => {
    digest("2026-07-04", "body");
    slides("2026-07-04", ["pm"]);
    buildSite(root, out);
    const feed = readFileSync(join(out, "feed.xml"), "utf8");
    const day = readFileSync(join(out, "2026-07-04.html"), "utf8");
    expect(feed).toContain("<pubDate>Sat, 04 Jul 2026 16:34:00 GMT</pubDate>");
    expect(day).toContain('"datePublished":"2026-07-04T16:34:00Z"');
  });

  it("marks the evening rewrite in the feed without moving the day it went up", () => {
    digest("2026-07-03", "body");
    digest("2026-07-04", "body");
    slides("2026-07-04", ["am", "pm"]);
    buildSite(root, out);
    const feed = readFileSync(join(out, "feed.xml"), "utf8");
    // The rewritten day keeps the instant it went up and says separately when
    // it last changed: the same two instants its page head carries.
    expect(feed).toContain(
      "<pubDate>Sat, 04 Jul 2026 04:34:00 GMT</pubDate>\n<atom:updated>2026-07-04T16:34:00Z</atom:updated>",
    );
    // The day nobody rewrote claims no update at all, so a reader is told
    // about the one that moved and nothing else.
    expect(feed).toContain("<pubDate>Fri, 03 Jul 2026 04:34:00 GMT</pubDate>\n</item>");
    expect(feed.match(/<atom:updated>/g)).toHaveLength(1);
    // The channel's own stamp is the newest day's last change, never the
    // build clock: rebuilding an unchanged archive rewrites nothing.
    expect(feed).toContain("<lastBuildDate>Sat, 04 Jul 2026 16:34:00 GMT</lastBuildDate>");
    buildSite(root, out);
    expect(readFileSync(join(out, "feed.xml"), "utf8")).toBe(feed);
  });

  it("claims no update for a day that was only ever published once", () => {
    // A pm-only day went up in the evening and was never rewritten, so its
    // publish and modified drops are the same instant and there is nothing
    // to tell a reader who already has it.
    digest("2026-07-04", "body");
    slides("2026-07-04", ["pm"]);
    buildSite(root, out);
    const feed = readFileSync(join(out, "feed.xml"), "utf8");
    expect(feed).not.toContain("<atom:updated>");
    expect(feed).toContain("<lastBuildDate>Sat, 04 Jul 2026 16:34:00 GMT</lastBuildDate>");
  });

  it("writes an rss feed and links it from every page", () => {
    digest("2026-07-03", "body");
    digest("2026-07-04", "body");
    buildSite(root, out);
    const feed = readFileSync(join(out, "feed.xml"), "utf8");
    expect(feed).toContain("<rss version=\"2.0\"");
    expect(feed).toContain("<title>sift</title>");
    expect(feed).toContain("<link>https://sift.yasint.dev/2026-07-04.html</link>");
    expect(feed).toContain("top story of 2026-07-03");
    expect(feed.indexOf("2026-07-04.html")).toBeLessThan(feed.indexOf("2026-07-03.html"));
    expect(feed).toContain("04 Jul 2026");
    const index = readFileSync(join(out, "index.html"), "utf8");
    expect(index).toContain('<link rel="alternate" type="application/rss+xml" title="sift" href="/feed.xml">');
    expect(index).toContain('class="feed" href="/feed.xml"');
  });

  it("publishes latest.json carrying the newest day's digest hash", () => {
    digest("2026-07-03", "old body");
    digest("2026-07-04", "new body");
    buildSite(root, out);
    const latest = JSON.parse(readFileSync(join(out, "latest.json"), "utf8"));
    expect(latest.day).toBe("2026-07-04");
    const raw = readFileSync(join(root, "digests", "2026-07-04.md"));
    expect(latest.digest).toBe(createHash("sha256").update(raw).digest("hex"));
  });

  it("writes a noindex 404 page that explains missing day pages", () => {
    digest("2026-07-03", "body");
    buildSite(root, out);
    const nf = readFileSync(join(out, "404.html"), "utf8");
    expect(nf).toContain('<meta name="robots" content="noindex">');
    expect(nf).toContain("nothing sifted here");
    expect(nf).toContain('href="/"');
    expect(nf).toContain('href="/favicons/favicon.svg"');
    expect(nf).toContain('timeZone: "Europe/Oslo"');
    expect(nf).toContain('"</strong> and <strong>" + PM + "</strong> Oslo time');
    expect(nf).toContain("https://github.com/yasinmiran/sift");
    const index = readFileSync(join(out, "index.html"), "utf8");
    expect(index).not.toContain('<meta name="robots" content="noindex">');
  });

  // A day page 404s forever once the rolling month passes it, and far more
  // urls are in that state than out of it (123 days published, 32 live). The
  // sentence those readers get has one link in it, so it has to land on the
  // day rather than on digests/, whose history is every ingest commit the
  // repo ever made.
  it("sends a rolled-out day to its own file history, not the folder's", () => {
    digest("2026-07-03", "body");
    buildSite(root, out);
    const nf = readFileSync(join(out, "404.html"), "utf8");
    expect(nf).toContain('commits/main/digests/" + day + ".md');
    expect(nf).not.toContain('commits/main/digests\\">');
  });

  it("links the web app manifest in the shell and ships it with the site", () => {
    digest("2026-07-04", "body");
    mkdirSync(join(root, "public"), { recursive: true });
    writeFileSync(join(root, "public", "manifest.webmanifest"), '{"name":"sift"}');
    buildSite(root, out);
    const day = readFileSync(join(out, "2026-07-04.html"), "utf8");
    expect(day).toContain('<link rel="manifest" href="/manifest.webmanifest">');
    expect(readFileSync(join(out, "manifest.webmanifest"), "utf8")).toContain('"name":"sift"');
  });

  it("emits a push-only service worker and registers it in the shell", () => {
    digest("2026-07-04", "body");
    buildSite(root, out);
    const sw = readFileSync(join(out, "sw.js"), "utf8");
    expect(sw).toContain('addEventListener("push"');
    expect(sw).toContain('addEventListener("notificationclick"');
    expect(sw).not.toContain('addEventListener("fetch"');
    const day = readFileSync(join(out, "2026-07-04.html"), "utf8");
    expect(day).toContain('serviceWorker.register("/sw.js")');
  });

  it("registers the worker even where the reader's browser denies site data", () => {
    digest("2026-07-04", "body");
    buildSite(root, out);
    const day = readFileSync(join(out, "2026-07-04.html"), "utf8");
    // Storage answering: the arrival is remembered and the backlink returns
    // the reader to the page they left.
    expect(runShell(day, [])).toEqual({
      registered: ["/sw.js"],
      remembered: ["/notes"],
      href: "https://yasint.dev/earlier",
    });
    // Storage denied: the backlink quietly stays on yasint.dev's root, and
    // the worker still registers. notify.ts un-hides the bell only from
    // inside navigator.serviceWorker.ready, so losing this line loses push.
    expect(runShell(day, ["sessionStorage"])).toEqual({
      registered: ["/sw.js"],
      remembered: [],
      href: null,
    });
  });

  it("offers push notifications on the index only", () => {
    digest("2026-07-04", "body");
    buildSite(root, out);
    const index = readFileSync(join(out, "index.html"), "utf8");
    expect(index).toContain('id="notify"');
    expect(index).toContain("PushManager");
    expect(index).toContain("applicationServerKey");
    const day = readFileSync(join(out, "2026-07-04.html"), "utf8");
    expect(day).not.toContain('id="notify"');
  });

  it("sets the ios install path in a colour that passes AA", () => {
    digest("2026-07-04", "body");
    buildSite(root, out);
    const index = readFileSync(join(out, "index.html"), "utf8");
    // The hint and the dialog's note are the only route to notifications for
    // a reader whose browser has no PushManager, so neither may sit on
    // --muted: 4.13:1 against --bg and 3.74:1 against the dialog's --surface,
    // both under AA's 4.5 at these sizes. The hint carries --body outright
    // rather than on :hover, which a touch-only device need never fire, and
    // the note inherits the dialog's --body by declaring no colour at all.
    expect(index).toMatch(/\.notify-hint\{[^}]*color:var\(--body\)/);
    expect(index).not.toMatch(/\.notify-hint\{[^}]*color:var\(--muted\)/);
    expect(index).toMatch(/\.install-help\{[^}]*color:var\(--body\)/);
    expect(index).toMatch(/\.help-note\{(?![^}]*color:)[^}]*\}/);
  });

  it("tells today's readers when the evening half lands, in their own time zone", () => {
    digest("2026-07-04", "body");
    buildSite(root, out);
    const day = readFileSync(join(out, "2026-07-04.html"), "utf8");
    expect(day).toContain('id="refresh-note"');
    expect(day).toContain('the evening update lands <strong>around " + PM + "</strong> (Oslo time)');
    expect(day).toContain("minsOf(PM) - minsOf(clock)");
    expect(day).toContain("in case you have them on");
    expect(day).toContain("your time");
    expect(day).toContain("left * 60000");
    // The subscribed reader's retirement is wired to the gated helper, and
    // nothing in this script collapses the note on its own.
    const note = [...day.matchAll(/<script>([^]*?)<\/script>/g)]
      .map((m) => m[1]!)
      .find((src) => src.includes("refresh-note"));
    expect(note, "the refresh-note script is not in the built day page").toBeDefined();
    expect(note).toContain("retireForSubscriber(slot, window, matchMedia(");
    // One collapse in the whole script, the gated one inside retireWhenPast:
    // the branch this replaced carried a second.
    expect(note!.match(/slot\.hidden = true/g)).toHaveLength(1);
    expect(note!.slice(note!.indexOf("slot.hidden = true"))).toContain("requestAnimationFrame");
  });

  it("walks a day page to its neighbours in both directions", () => {
    digest("2026-07-03", "body");
    digest("2026-07-04", "body");
    digest("2026-07-05", "body");
    buildSite(root, out);
    const day = readFileSync(join(out, "2026-07-04.html"), "utf8");
    expect(day).toContain('<nav class="pager"');
    expect(day).toContain('rel="prev" href="2026-07-03.html"');
    expect(day).toContain('rel="next" href="2026-07-05.html"');
    expect(day).toContain("Fri, Jul 3");
    expect(day).toContain("Sun, Jul 5");
    // After the day's own reading, before the site chrome.
    expect(day.indexOf("</article>")).toBeLessThan(day.indexOf('class="pager"'));
    expect(day.indexOf('class="pager"')).toBeLessThan(day.indexOf('<footer class="foot">'));
  });

  // wcag 2.5.3 wants a control's visible words inside its accessible name, in
  // their visible order, which rules out both shapes the first version had:
  // "digest" between the two words, and no space before the date (the link's
  // two lines are flex items, so the name ran them together as "earlierFri").
  it("names each pager link with its own visible text, in order", () => {
    digest("2026-07-03", "body");
    digest("2026-07-04", "body");
    digest("2026-07-05", "body");
    buildSite(root, out);
    const day = readFileSync(join(out, "2026-07-04.html"), "utf8");
    expect(day).toContain('aria-label="earlier Fri, Jul 3 digest"><span class="mono">&larr; earlier</span> Fri, Jul 3</a>');
    expect(day).toContain('aria-label="later Sun, Jul 5 digest"><span class="mono">later &rarr;</span> Sun, Jul 5</a>');
  });

  it("leaves off the neighbour a rolling month does not have", () => {
    digest("2026-07-03", "body");
    digest("2026-07-04", "body");
    buildSite(root, out);
    const newest = readFileSync(join(out, "2026-07-04.html"), "utf8");
    expect(newest).toContain('rel="prev" href="2026-07-03.html"');
    expect(newest).not.toContain('rel="next"');
    const oldest = readFileSync(join(out, "2026-07-03.html"), "utf8");
    expect(oldest).toContain('rel="next" href="2026-07-04.html"');
    expect(oldest).not.toContain('rel="prev"');
  });

  // Passes with or without the pager, so not a regression case: it pins that
  // the only day in the archive gets no empty nav rendered around nothing.
  it("renders no pager when the archive holds one day", () => {
    digest("2026-07-04", "body");
    buildSite(root, out);
    const day = readFileSync(join(out, "2026-07-04.html"), "utf8");
    expect(day).not.toContain('class="pager"');
  });

  it("uses semantic landmarks with the buttons in the index masthead", () => {
    digest("2026-07-04", "body");
    buildSite(root, out);
    const index = readFileSync(join(out, "index.html"), "utf8");
    expect(index).toContain('<header class="head">');
    expect(index).toContain("<main>");
    expect(index.indexOf('id="notify"')).toBeLessThan(index.indexOf("<main>"));
    const day = readFileSync(join(out, "2026-07-04.html"), "utf8");
    expect(day).toContain('<nav class="crumbs" aria-label="archive">');
    expect(day).toContain("<article>");
    expect(day.indexOf("<header>")).toBeLessThan(day.indexOf('class="prose"'));
    const nf = readFileSync(join(out, "404.html"), "utf8");
    expect(nf).toContain('<nav class="crumbs" aria-label="archive">');
    expect(nf).toContain("<main>");
  });

  // A day page carries two navigation landmarks, the crumbs and the pager, and
  // an unnamed one is announced as a bare "navigation" in the landmark list.
  // Asserted over every built page rather than the crumbs alone, since the next
  // nav added anywhere is the one that would ship unnamed.
  it("names every navigation landmark it renders", () => {
    digest("2026-07-03", "body");
    digest("2026-07-04", "body");
    digest("2026-07-05", "body");
    buildSite(root, out);
    for (const file of readdirSync(out).filter((f) => f.endsWith(".html"))) {
      const html = readFileSync(join(out, file), "utf8");
      const labels = [...html.matchAll(/<nav\b[^>]*>/g)].map((m) => /aria-label="([^"]*)"/.exec(m[0])?.[1] ?? "");
      for (const label of labels) expect(label, `${file} renders an unnamed nav`).not.toBe("");
      expect(new Set(labels).size, `${file} repeats a nav label`).toBe(labels.length);
    }
  });

  // showModal() makes everything outside the dialog inert, so the dialog's own
  // accessible name is all a screen reader is given on entry, and a native
  // <dialog> takes no name from its contents. Chromium's AX tree printed
  // `dialog name=""` for the install help; axe is 0 violations on the open
  // dialog because aria-dialog-name selects [role="dialog"] only, and
  // html-validate has no rule for it, so the gate lives here. Asserted over
  // every built page, since the next dialog added anywhere is the one that
  // would ship unnamed.
  it("names every dialog it renders", () => {
    digest("2026-07-03", "body");
    digest("2026-07-04", "body");
    buildSite(root, out);
    let dialogs = 0;
    for (const file of readdirSync(out).filter((f) => f.endsWith(".html"))) {
      const $ = load(readFileSync(join(out, file), "utf8"));
      for (const el of $("dialog").toArray()) {
        dialogs += 1;
        const label = ($(el).attr("aria-label") ?? "").trim();
        // A labelledby pointing at nothing, or at an element that renders
        // empty, is the same unnamed dialog with an attribute on it.
        const named =
          label !== "" ||
          ($(el).attr("aria-labelledby") ?? "")
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .some((id) => $(`#${id}`).text().trim() !== "");
        expect(named, `${file} renders a dialog with no accessible name`).toBe(true);
      }
    }
    expect(dialogs).toBeGreaterThan(0);
  });

  // The canonical tag, the sitemap, the manifest's start_url and sw.js's
  // notification fallback all name the index "/", so a page linking the file
  // name serves it under a second url nothing advertises and goatcounter
  // counts separately. One url for one page, asserted on every built page
  // rather than on the crumbs alone, since any new link home would drift the
  // same way.
  it("links the index at its canonical / from every built page", () => {
    digest("2026-07-03", "body");
    digest("2026-07-04", "body");
    buildSite(root, out);
    const pages = readdirSync(out).filter((f) => f.endsWith(".html"));
    expect(pages).toHaveLength(4);
    for (const file of pages) {
      const html = readFileSync(join(out, file), "utf8");
      expect(html, `${file} links the index by file name`).not.toContain('href="index.html"');
    }
    for (const file of ["2026-07-03.html", "2026-07-04.html", "404.html"]) {
      expect(readFileSync(join(out, file), "utf8")).toContain('<nav class="crumbs" aria-label="archive"><a href="/">');
    }
    expect(readFileSync(join(out, "index.html"), "utf8")).toContain(
      '<link rel="canonical" href="https://sift.yasint.dev/">',
    );
  });

  it("unescapes yaml quote escapes and keeps quotes attribute-safe", () => {
    writeFileSync(
      join(root, "digests", "2026-07-04.md"),
      `---\ntitle: "sift: 2026-07-04"\ndescription: "it thinks \\"blackmail\\" quietly"\ndate: "2026-07-04"\n---\n\nbody\n`,
    );
    buildSite(root, out);
    const index = readFileSync(join(out, "index.html"), "utf8");
    expect(index).toContain("it thinks &quot;blackmail&quot; quietly");
    expect(index).not.toContain("\\&quot;");
    const day = readFileSync(join(out, "2026-07-04.html"), "utf8");
    expect(day).toContain('<meta name="description" content="it thinks &quot;blackmail&quot; quietly">');
  });

  it("features the newest day as a hero above the older days", () => {
    digest("2026-07-03", "body");
    digest("2026-07-04", "body");
    digest("2026-07-05", "body");
    buildSite(root, out);
    const index = readFileSync(join(out, "index.html"), "utf8");
    expect(index).toContain('class="hero"');
    expect(index).toContain('data-day="2026-07-05"');
    expect(index.match(/href="2026-07-05\.html"/g)).toHaveLength(1);
    expect(index.indexOf('class="hero"')).toBeLessThan(index.indexOf('class="days"'));
    expect(index.indexOf('class="hero"')).toBeGreaterThan(index.indexOf("<main>"));
    expect(index).toContain("top story of 2026-07-05");
  });

  it("relabels the current and previous day client-side", () => {
    digest("2026-07-04", "body");
    digest("2026-07-05", "body");
    buildSite(root, out);
    const index = readFileSync(join(out, "index.html"), "utf8");
    expect(index).toContain('class="when"');
    expect(index).toContain('"yesterday"');
    expect(index).toContain("864e5");
  });

  it("ends the day list without a rule and notes retention on the index", () => {
    digest("2026-07-04", "body");
    buildSite(root, out);
    const index = readFileSync(join(out, "index.html"), "utf8");
    expect(index).toContain(".days li:last-child{border-bottom:none}");
    expect(index).toContain("rolling month");
    const day = readFileSync(join(out, "2026-07-04.html"), "utf8");
    expect(day).not.toContain("rolling month");
  });

  it("gives the notify and install buttons icons and an install prompt hook", () => {
    digest("2026-07-04", "body");
    buildSite(root, out);
    const index = readFileSync(join(out, "index.html"), "utf8");
    expect(index).toContain("M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9");
    expect(index).toContain("beforeinstallprompt");
    expect(index).toContain("install app");
    expect(index).toContain("display-mode: standalone");
    expect(index).toContain("getInstalledRelatedApps");
    expect(index).toContain("<span>installed</span>");
    expect(index).toContain("20 6 9 17 4 12");
    expect(index).toContain("sift-installed");
    expect(index).toContain("FLAG_TTL");
    expect(index).toContain('<dialog id="install-help"');
    expect(index).toContain("Add to Home Screen");
    const day = readFileSync(join(out, "2026-07-04.html"), "utf8");
    expect(day).not.toContain("beforeinstallprompt");
  });

  it("keeps the hidden attribute working on the notify block's buttons", () => {
    digest("2026-07-04", "body");
    buildSite(root, out);
    const index = readFileSync(join(out, "index.html"), "utf8");
    const css = /<style>([^]*?)<\/style>/.exec(index)?.[1] ?? "";
    // An author display declaration outranks the ua sheet's
    // [hidden]{display:none} whatever the specificity, so a class here that
    // sets display needs a guard of its own or el.hidden = true is a no-op on
    // it. notify.ts builds the install button hidden and reveals it when the
    // browser offers beforeinstallprompt; unguarded it shipped visible and
    // dead instead, and at 120px beside the bell it took .notify to 241px,
    // past .head's wrap point under ~480px, so the archive dropped 54px when
    // the bell landed. .notify had the guard from the start; its buttons did
    // not, which is the same rule forgotten one element down.
    const sets = [...css.matchAll(/^\.(notify[a-z-]*)\{[^}]*display:(?!none)/gm)].map((m) => m[1]);
    expect(sets).toContain("notify-btn");
    for (const cls of new Set(sets)) {
      expect(css, `.${cls} sets display with no [hidden] guard`).toContain(`.${cls}[hidden]{display:none}`);
    }
    expect(index).toContain("install.hidden = true");
  });

  // The notify script never runs under vitest, so drive the shipped source in
  // a stand-in dom the way sw.test.ts drives the worker: what the assertion
  // reads is the bell at the moment it joins the row. serviceWorker.ready is
  // left pending, which is every reader's state at first paint, and the
  // install path un-hides that row from inside it (a standalone launch, or
  // the 7-day installed flag). Appended empty, the bell sat in an installed
  // reader's header as a 28x15 button with no text and no title, and took the
  // archive down 54px when it filled: cls 0.1859 against 0.0000074 with the
  // label there from the start. Hiding it until ready measures worse (0.2177),
  // because the row then wraps late rather than not at all.
  it("gives the bell its label before it joins the header row", () => {
    digest("2026-07-04", "body");
    buildSite(root, out);
    const index = readFileSync(join(out, "index.html"), "utf8");
    const src = [...index.matchAll(/<script>([^]*?)<\/script>/g)]
      .map((m) => m[1]!)
      .find((s) => s.includes("PushManager"));
    expect(src, "the notify script is not in the built index").toBeDefined();

    type Node = { innerHTML: string; hidden: boolean; [k: string]: unknown };
    const node = (): Node => ({
      className: "",
      innerHTML: "",
      title: "",
      hidden: false,
      disabled: false,
      classList: { add: () => {}, remove: () => {} },
      querySelector: () => null,
      addEventListener: () => {},
      append: () => {},
      prepend: () => {},
    });
    const joined: Node[] = [];
    const slot: Node = { ...node(), hidden: true, prepend: (n: Node) => void joined.push(n) };

    new Function("document", "navigator", "window", "matchMedia", "localStorage", src!)(
      { getElementById: (id: string) => (id === "notify" ? slot : node()), createElement: () => node() },
      { serviceWorker: { ready: new Promise(() => {}) } },
      { PushManager: class {}, addEventListener: () => {} },
      () => ({ matches: false }),
      { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    );

    // No install event in this stand-in, so the bell is the only control that
    // reaches the row, and it carries the idle face rather than an empty box.
    expect(joined).toHaveLength(1);
    expect(joined[0]!.innerHTML).not.toBe("");
    expect(joined[0]!.innerHTML).toContain("notify me");
    expect(joined[0]!.title).toBe("get a push when a new digest lands");
    // render() still owns the reveal: nothing un-hides the row before it.
    expect(slot.hidden).toBe(true);
  });

  // Same stand-in, driven one step further: the click handler, with the round
  // trip parked on a gate so the busy window is open while the assertions run.
  // Chromium takes focus off an element that becomes disabled, so the reader
  // who pressed enter on the bell was dropped onto <body> for the whole trip
  // (activeElement BUTTON -> BODY at +150ms, in both permission outcomes, the
  // a11y tree's focused flag with it) and the label change the press exists
  // for, notify me -> on, landed on an element nothing was reading. The gate
  // is the property: the handler holds its window in aria instead, so the
  // button stays focusable, and the closure flag does the guarding the
  // property used to do for free.
  it("keeps the bell focusable while it works, and says so in aria", async () => {
    digest("2026-07-04", "body");
    buildSite(root, out);
    const index = readFileSync(join(out, "index.html"), "utf8");
    const src = [...index.matchAll(/<script>([^]*?)<\/script>/g)]
      .map((m) => m[1]!)
      .find((s) => s.includes("PushManager"));
    expect(src, "the notify script is not in the built index").toBeDefined();

    type Fake = {
      disabled: boolean;
      hidden: boolean;
      attr: Record<string, string>;
      cls: Set<string>;
      clicks: Array<() => Promise<void>>;
      getAttribute: (n: string) => string | null;
      [k: string]: unknown;
    };
    const node = (): Fake => {
      const attr: Record<string, string> = {};
      const cls = new Set<string>();
      const clicks: Array<() => Promise<void>> = [];
      return {
        className: "",
        innerHTML: "",
        title: "",
        hidden: false,
        disabled: false,
        attr,
        cls,
        clicks,
        setAttribute: (n: string, v: string) => void (attr[n] = v),
        removeAttribute: (n: string) => void delete attr[n],
        getAttribute: (n: string) => attr[n] ?? null,
        classList: { add: (c: string) => void cls.add(c), remove: (c: string) => void cls.delete(c) },
        querySelector: () => null,
        addEventListener: (t: string, fn: () => Promise<void>) => void (t === "click" && clicks.push(fn)),
        append: () => {},
        prepend: () => {},
      };
    };
    const joined: Fake[] = [];
    const slot: Fake = { ...node(), hidden: true, prepend: (n: Fake) => void joined.push(n) };

    // The reader is already subscribed, so the press is the unsubscribe trip:
    // one DELETE and one unsubscribe(), both behind a gate this test holds.
    let open: () => void = () => {};
    const gate = new Promise<void>((resolve) => (open = resolve));
    let deletes = 0;
    const dropped: string[] = [];
    const sub = {
      endpoint: "https://push.test/ep",
      unsubscribe: async () => void dropped.push("gone"),
    };
    const ready = Promise.resolve({ pushManager: { getSubscription: async () => sub } });

    new Function("document", "navigator", "window", "matchMedia", "localStorage", "fetch", src!)(
      { getElementById: (id: string) => (id === "notify" ? slot : node()), createElement: () => node() },
      { serviceWorker: { ready } },
      { PushManager: class {}, addEventListener: () => {} },
      () => ({ matches: false }),
      { getItem: () => null, setItem: () => {}, removeItem: () => {} },
      async () => {
        await gate;
        deletes += 1;
        return { ok: true };
      },
    );

    const bell = joined[0]!;
    expect(bell.clicks).toHaveLength(1);
    const press = bell.clicks[0]!;
    const inFlight = press();
    await new Promise((r) => setTimeout(r, 0));

    // mid-window: the button is still the focusable thing the reader pressed
    expect(bell.disabled, "a disabled button loses focus in chromium").toBe(false);
    expect(bell.getAttribute("aria-disabled")).toBe("true");
    expect(bell.getAttribute("aria-busy")).toBe("true");
    expect(bell.cls.has("busy")).toBe(true);
    expect(deletes, "the round trip is parked on the gate").toBe(0);

    // and a second press inside the window is still a no-op, which is the one
    // thing the disabled property was doing for us
    await press();
    await new Promise((r) => setTimeout(r, 0));
    expect(deletes).toBe(0);
    expect(dropped).toHaveLength(0);

    open();
    await inFlight;
    expect(deletes, "one press, one round trip").toBe(1);
    expect(dropped).toHaveLength(1);
    expect(bell.disabled).toBe(false);
    expect(bell.getAttribute("aria-disabled")).toBe(null);
    expect(bell.getAttribute("aria-busy")).toBe(null);
    expect(bell.cls.has("busy")).toBe(false);
  });

  it("keeps hover off the notify buttons that are disabled", () => {
    digest("2026-07-04", "body");
    buildSite(root, out);
    const index = readFileSync(join(out, "index.html"), "utf8");
    const css = /<style>([^]*?)<\/style>/.exec(index)?.[1] ?? "";
    // :hover matches a disabled button; :active does not. So every hover rule
    // on .notify-btn has to say so in its own selector, because the sheet's
    // earlier answer -- a .notify-btn:disabled:hover rule undoing hover one
    // declaration at a time -- undid border-color and left color standing,
    // and chromium duly painted the installed chip and every in-flight click
    // --bold under the pointer, the enabled hover's own colour. The same rule
    // forgotten one state down, which is this block's recurring failure.
    // aria-disabled is that one state down: the bell's busy window lives there
    // now so it keeps focus, and a focusable button matches :active as well as
    // :hover, so both pressed states need the guard the property gave for free.
    const hovers = [...css.matchAll(/^(\.notify-btn[^{]*:hover[^{]*)\{/gm)].map((m) => m[1]!);
    expect(hovers.length).toBeGreaterThan(0);
    for (const sel of hovers) {
      expect(sel, `${sel} can match a disabled button`).toContain(":not(:disabled)");
      expect(sel, `${sel} can match the bell while it works`).toContain(':not([aria-disabled="true"])');
    }
    const actives = [...css.matchAll(/^(\.notify-btn[^{]*:active[^{]*)\{/gm)].map((m) => m[1]!);
    expect(actives.length).toBeGreaterThan(0);
    for (const sel of actives) {
      // :active cannot reach a disabled button at all, so that guard is the
      // aria one only.
      expect(sel, `${sel} can match the bell while it works`).toContain(':not([aria-disabled="true"])');
    }
    // and the enabled hover is still there to be guarded
    expect(css).toContain(
      '.notify-btn:not(:disabled):not([aria-disabled="true"]):hover{border-color:var(--accent);color:var(--bold)}',
    );
  });

  // The claim is readability on paper, so assert the ratio rather than the
  // hexes: chrome prints with background graphics off, which leaves the sheet
  // white and every token as declared (--text 1.29:1 against it, --body 2.15).
  // Computed from the print block's own :root, so a later retune that drops a
  // token back below AA fails here even if it keeps the block's shape.
  it("re-inks the palette for print so a printed digest reads on paper", () => {
    digest("2026-07-04", "## Section\n\n- **lead**: [story](https://example.com/a) why it matters");
    buildSite(root, out);
    for (const file of ["index.html", "2026-07-04.html"]) {
      const html = readFileSync(join(out, file), "utf8");
      const block = /@media print\{([^]*?)\n\}/.exec(html);
      expect(block, `${file} has no @media print block`).not.toBeNull();
      const css = block?.[1] ?? "";

      const channel = (c: number): number => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
      const onPaper = (hex: string): number => {
        const n = Number.parseInt(hex.slice(1), 16);
        const l =
          0.2126 * channel(((n >> 16) & 255) / 255) +
          0.7152 * channel(((n >> 8) & 255) / 255) +
          0.0722 * channel((n & 255) / 255);
        return 1.05 / (l + 0.05);
      };
      for (const token of ["text", "bold", "body", "muted", "faint", "accent"]) {
        const hex = new RegExp(`--${token}:(#[0-9a-f]{6})`).exec(css)?.[1];
        expect(hex, `${file}: print block leaves --${token} at its screen value`).toBeDefined();
        expect(onPaper(hex!), `${file}: --${token} is ${hex} on paper`).toBeGreaterThanOrEqual(4.5);
      }

      // The sheet stays white even for a reader who prints backgrounds, and
      // that takes both halves: background:none drops the page's own paint,
      // color-scheme decides which ua canvas is under it. Left dark, the
      // re-inked palette prints on #121212 at 1.06:1 and every ratio above
      // is measured against a sheet the reader never gets.
      expect(css).toContain("color-scheme:light");
      expect(css).toContain("body{max-width:none;padding:0;background:none}");
      expect(css).toContain(".crumbs,.pager,.notify,.today-note{display:none}");
    }
  });
});
