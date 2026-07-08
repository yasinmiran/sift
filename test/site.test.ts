import { beforeEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildSite } from "../src/site/build";

let root: string;
let out: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "sift-site-"));
  out = join(root, "site");
  mkdirSync(join(root, "digests"), { recursive: true });
});

const digest = (day: string, body: string) =>
  writeFileSync(
    join(root, "digests", `${day}.md`),
    `---\ntitle: "The day's tech, sifted: ${day}"\ndescription: "top story of ${day}"\ndate: "${day}"\n---\n\n${body}\n`,
  );

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

  it("gives the index a today slot that redirects or reports the next drop", () => {
    digest("2026-07-03", "body");
    buildSite(root, out);
    const index = readFileSync(join(out, "index.html"), "utf8");
    expect(index).toContain('<section id="today" class="today-note" hidden></section>');
    expect(index).toContain('timeZone: "Europe/Oslo"');
    expect(index).toContain("location.replace");
    expect(index).toContain("06:45");
    expect(index).toContain("18:45");
    const day = readFileSync(join(out, "2026-07-03.html"), "utf8");
    expect(day).not.toContain('id="today"');
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

  it("emits structured data for the site and each day", () => {
    digest("2026-07-04", "body");
    buildSite(root, out);
    const index = readFileSync(join(out, "index.html"), "utf8");
    expect(index).toContain('<script type="application/ld+json">');
    expect(index).toContain('"@type":"WebSite"');
    const day = readFileSync(join(out, "2026-07-04.html"), "utf8");
    expect(day).toContain('"@type":"NewsArticle"');
    expect(day).toContain('"datePublished":"2026-07-04"');
    expect(day).toContain('"headline":"The day\'s tech, sifted: 2026-07-04"');
    expect(day).toContain('<meta property="article:published_time" content="2026-07-04">');
    expect(index).not.toContain("article:published_time");
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

  it("writes a noindex 404 page that explains missing day pages", () => {
    digest("2026-07-03", "body");
    buildSite(root, out);
    const nf = readFileSync(join(out, "404.html"), "utf8");
    expect(nf).toContain('<meta name="robots" content="noindex">');
    expect(nf).toContain("nothing sifted here");
    expect(nf).toContain('href="/"');
    expect(nf).toContain('href="/favicons/favicon.svg"');
    expect(nf).toContain('timeZone: "Europe/Oslo"');
    expect(nf).toContain("06:45");
    expect(nf).toContain("18:45");
    expect(nf).toContain("https://github.com/yasinmiran/sift");
    const index = readFileSync(join(out, "index.html"), "utf8");
    expect(index).not.toContain('<meta name="robots" content="noindex">');
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

  it("tells today's readers when the evening half lands, in their own time zone", () => {
    digest("2026-07-04", "body");
    buildSite(root, out);
    const day = readFileSync(join(out, "2026-07-04.html"), "utf8");
    expect(day).toContain('id="refresh-note"');
    expect(day).toContain("18:45");
    expect(day).toContain("in case you have them on");
    expect(day).toContain("your time");
    expect(day).toContain("left * 60000");
  });

  it("uses semantic landmarks with the buttons in the index masthead", () => {
    digest("2026-07-04", "body");
    buildSite(root, out);
    const index = readFileSync(join(out, "index.html"), "utf8");
    expect(index).toContain('<header class="head">');
    expect(index).toContain("<main>");
    expect(index.indexOf('id="notify"')).toBeLessThan(index.indexOf("<main>"));
    const day = readFileSync(join(out, "2026-07-04.html"), "utf8");
    expect(day).toContain('<nav class="crumbs">');
    expect(day).toContain("<article>");
    expect(day.indexOf("<header>")).toBeLessThan(day.indexOf('class="prose"'));
    const nf = readFileSync(join(out, "404.html"), "utf8");
    expect(nf).toContain('<nav class="crumbs">');
    expect(nf).toContain("<main>");
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
});
