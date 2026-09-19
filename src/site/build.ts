// Renders digests/ into the static site: one page per day, the index,
// sitemap, robots and the 404 page (CLI: npm run site).
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseFrontmatter } from "../digest/frontmatter";
import { readSlidePosts } from "../slides/data";
import { formatDay } from "./day-format";
import { escapeHtml } from "./html";
import { renderMarkdown } from "./markdown";
import { notFoundPage } from "./not-found";
import { notifyBlock } from "./notify";
import { BASE_URL, GOATCOUNTER_URL, page, SITE_DESCRIPTION } from "./page";
import { SW_SOURCE } from "./sw";
import { refreshNote, todayScript } from "./today";

interface Digest {
  day: string;
  title: string;
  description: string;
  body: string;
}

function parseDigest(day: string, raw: string): Digest {
  const { meta, body } = parseFrontmatter(raw);
  return {
    day,
    title: meta?.title ?? `sift: ${day}`,
    description: meta?.description ?? "",
    body,
  };
}

// The two drops the whole site is built around: the morning digest lands
// right after the 04:34 UTC run, the evening rewrite right after 16:34.
// One helper so the schedule is written down once — rss reads it as an
// http-date, structured data, Open Graph and the sitemap as ISO 8601.
type Drop = readonly [hour: number, minute: number];
const AM_DROP: Drop = [4, 34];
const PM_DROP: Drop = [16, 34];

function dropAt(day: string, [hour, minute]: Drop): Date {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d, hour, minute));
}

const feedDate = (day: string, drop: Drop): string => dropAt(day, drop).toUTCString();
// Seconds, no milliseconds: still ISO 8601, and the drop is a schedule.
const isoDate = (day: string, drop: Drop): string =>
  dropAt(day, drop).toISOString().replace(/\.\d{3}Z$/, "Z");

// Slot follows time, not trigger (AGENTS.md): the morning run writes the am
// carousel post, the evening one appends pm, and a day whose morning was
// skipped gets its single post as pm, covering the full day. So the slots
// present are the drops that produced the page — the first is when it went
// up, the last when it last changed. A pm-only day published once, in the
// evening, and was never rewritten.
//
// Read defensively: an unreadable carousel is verify.ts's error to report,
// never a reason the site fails to build, and a day without one falls back
// to the morning drop rather than guessing.
function dropsOf(rootDir: string, day: string): { published: Drop; modified: Drop } {
  let slots: string[] = [];
  try {
    slots = readSlidePosts(rootDir, day)?.posts.map((p) => p.slot) ?? [];
  } catch {
    slots = [];
  }
  return {
    published: slots.length > 0 && !slots.includes("am") ? PM_DROP : AM_DROP,
    modified: slots.includes("pm") ? PM_DROP : AM_DROP,
  };
}

const AUTHOR = { "@type": "Person", name: "Yasin", url: "https://yasint.dev" };

export function buildSite(rootDir: string, outDir: string): { pages: number } {
  const dir = join(rootDir, "digests");
  const days = existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
        .map((f) => f.slice(0, -3))
        .sort()
        .reverse()
    : [];
  // One read of each day's carousel, shared by the page head, the sitemap and
  // the feed, so the three cannot answer "when did this go up, when did it
  // last change" differently within one build.
  const digests = days.map((d) => ({
    ...parseDigest(d, readFileSync(join(dir, `${d}.md`), "utf8")),
    ...dropsOf(rootDir, d),
  }));

  mkdirSync(outDir, { recursive: true });
  const pub = join(rootDir, "public");
  if (existsSync(pub)) cpSync(pub, outDir, { recursive: true });

  for (const d of digests) {
    const published = isoDate(d.day, d.published);
    const modified = isoDate(d.day, d.modified);
    const body = `
      <nav class="crumbs"><a href="index.html">&larr; all days</a></nav>
      <main>
      <article>
      <header>
      <h1>${escapeHtml(d.title)}</h1>
      <p class="meta">${formatDay(d.day)}<span id="views" hidden></span></p>
      </header>
      ${refreshNote()}
      <div class="prose">${renderMarkdown(d.body)}</div>
      </article>
      </main>
<script>
fetch("${GOATCOUNTER_URL}/counter/" + encodeURIComponent(location.pathname) + ".json")
  .then((r) => (r.ok ? r.json() : null))
  .then((c) => {
    if (!c) return;
    const views = document.getElementById("views");
    views.textContent = " \\u00b7 " + c.count.replace(/[\\u2009\\u202f]/g, ",") + " views";
    views.hidden = false;
  })
  .catch(() => {});
</script>`;
    writeFileSync(
      join(outDir, `${d.day}.html`),
      page(
        {
          title: d.title,
          description: d.description,
          path: `${d.day}.html`,
          type: "article",
          published,
          modified,
          jsonLd: {
            "@context": "https://schema.org",
            "@type": "NewsArticle",
            headline: d.title,
            description: d.description,
            datePublished: published,
            dateModified: modified,
            author: AUTHOR,
            image: `${BASE_URL}/og.png`,
            mainEntityOfPage: `${BASE_URL}/${d.day}.html`,
          },
        },
        body,
      ),
    );
  }

  const [newest, ...rest] = digests;
  const hero = newest
    ? `<a class="hero" href="${newest.day}.html" data-day="${newest.day}">
        <p class="when"><span class="mono">${newest.day}</span> &middot; ${formatDay(newest.day)}</p>
        <p class="desc">${escapeHtml(newest.description)}</p>
        <span class="read">read the digest &rarr;</span>
      </a>`
    : `<p class="meta">nothing sifted yet.</p>`;
  const list =
    rest.length === 0
      ? ""
      : `<ul class="days">${rest
          .map(
            (d) => `
        <li>
          <a href="${d.day}.html" data-day="${d.day}"><span class="when"><span class="mono">${d.day}</span> &middot; ${formatDay(d.day)}</span></a>
          <p class="meta">${escapeHtml(d.description)}</p>
        </li>`,
          )
          .join("")}</ul>`;
  writeFileSync(
    join(outDir, "index.html"),
    page(
      {
        title: "sift: the day's tech, sifted",
        description: SITE_DESCRIPTION,
        path: "",
        type: "website",
        footNote: "this page keeps a rolling month of days; older ones live on in the repo's git history.",
        jsonLd: {
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "sift",
          url: `${BASE_URL}/`,
          description: SITE_DESCRIPTION,
          author: AUTHOR,
        },
      },
      `<header class="head"><div><h1>sift<span class="dot">.</span></h1><p class="tag">the day's tech, sifted</p></div>${notifyBlock()}</header>` +
        `<main><section id="today" class="today-note" hidden></section>${hero}${list}</main>${todayScript()}`,
    ),
  );

  // lastmod is what a crawler polls to decide on a recrawl, so it has to move
  // when the evening rewrite moves the page. The index is rebuilt from the
  // newest day's description, so it changes on that day's drops.
  const lastmodOf = (d: { day: string; modified: Drop }): string => isoDate(d.day, d.modified);
  const urls = [
    { loc: `${BASE_URL}/`, lastmod: newest ? lastmodOf(newest) : "" },
    ...digests.map((d) => ({ loc: `${BASE_URL}/${d.day}.html`, lastmod: lastmodOf(d) })),
  ];
  writeFileSync(
    join(outDir, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
      .map((u) => `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}</url>`)
      .join("\n")}\n</urlset>\n`,
  );
  writeFileSync(
    join(outDir, "feed.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>sift</title>
<link>${BASE_URL}/</link>
<atom:link href="${BASE_URL}/feed.xml" rel="self" type="application/rss+xml"/>
<description>${escapeHtml(SITE_DESCRIPTION)}</description>
<language>en</language>
${digests
  .map(
    (d) => `<item>
<title>${escapeHtml(d.title)}</title>
<link>${BASE_URL}/${d.day}.html</link>
<guid>${BASE_URL}/${d.day}.html</guid>
<description>${escapeHtml(d.description)}</description>
<pubDate>${feedDate(d.day, d.published)}</pubDate>
</item>`,
  )
  .join("\n")}
</channel>
</rss>
`,
  );
  if (newest) {
    // latest.json lets the push service notice same-day rewrites: the hash
    // only changes when the digest file itself does, never on code deploys.
    const raw = readFileSync(join(dir, `${newest.day}.md`));
    writeFileSync(
      join(outDir, "latest.json"),
      `${JSON.stringify({ day: newest.day, digest: createHash("sha256").update(raw).digest("hex") })}\n`,
    );
  }
  writeFileSync(join(outDir, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${BASE_URL}/sitemap.xml\n`);
  writeFileSync(join(outDir, "sw.js"), SW_SOURCE);
  writeFileSync(join(outDir, "404.html"), notFoundPage());

  return { pages: digests.length + 1 };
}

const invokedDirectly = process.argv[1]?.endsWith("build.ts");
if (invokedDirectly) {
  console.log(JSON.stringify(buildSite(resolve("."), resolve("site"))));
}
