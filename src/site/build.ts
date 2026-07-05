// Renders digests/ into the static site: one page per day, the index,
// sitemap, robots and the 404 page (CLI: npm run site).
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseFrontmatter } from "../digest/frontmatter";
import { escapeHtml } from "./html";
import { renderMarkdown } from "./markdown";
import { notFoundPage } from "./not-found";
import { notifyBlock } from "./notify";
import { BASE_URL, GOATCOUNTER_URL, page, SITE_DESCRIPTION } from "./page";
import { SW_SOURCE } from "./sw";
import { todayScript } from "./today";

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

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return `${WEEKDAY[date.getUTCDay()]}, ${MONTH[m - 1]} ${d}`;
}

export function buildSite(rootDir: string, outDir: string): { pages: number } {
  const dir = join(rootDir, "digests");
  const days = existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
        .map((f) => f.slice(0, -3))
        .sort()
        .reverse()
    : [];
  const digests = days.map((d) => parseDigest(d, readFileSync(join(dir, `${d}.md`), "utf8")));

  mkdirSync(outDir, { recursive: true });
  const pub = join(rootDir, "public");
  if (existsSync(pub)) cpSync(pub, outDir, { recursive: true });

  for (const d of digests) {
    const body = `
      <p class="crumbs"><a href="index.html">&larr; all days</a></p>
      <h1>${escapeHtml(d.title)}</h1>
      <p class="meta">${formatDay(d.day)}<span id="views" hidden></span></p>
      <article class="prose">${renderMarkdown(d.body)}</article>
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
      page({ title: d.title, description: d.description, path: `${d.day}.html`, type: "article" }, body),
    );
  }

  const list =
    digests.length === 0
      ? `<p class="meta">nothing sifted yet.</p>`
      : `<ul class="days">${digests
          .map(
            (d) => `
        <li>
          <a href="${d.day}.html"><span class="mono">${d.day}</span> &middot; ${formatDay(d.day)}</a>
          <p class="meta">${escapeHtml(d.description)}</p>
        </li>`,
          )
          .join("")}</ul>`;
  writeFileSync(
    join(outDir, "index.html"),
    page(
      { title: "sift: the day's tech, sifted", description: SITE_DESCRIPTION, path: "", type: "website" },
      `<h1>sift<span class="dot">.</span></h1><p class="tag">the day's tech, sifted</p>` +
        `<section id="today" class="today-note" hidden></section>${notifyBlock()}${list}${todayScript()}`,
    ),
  );

  const urls = [
    { loc: `${BASE_URL}/`, lastmod: days[0] },
    ...days.map((d) => ({ loc: `${BASE_URL}/${d}.html`, lastmod: d })),
  ];
  writeFileSync(
    join(outDir, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
      .map((u) => `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}</url>`)
      .join("\n")}\n</urlset>\n`,
  );
  writeFileSync(join(outDir, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${BASE_URL}/sitemap.xml\n`);
  writeFileSync(join(outDir, "sw.js"), SW_SOURCE);
  writeFileSync(join(outDir, "404.html"), notFoundPage());

  return { pages: digests.length + 1 };
}

const invokedDirectly = process.argv[1]?.endsWith("build.ts");
if (invokedDirectly) {
  console.log(JSON.stringify(buildSite(resolve("."), resolve("site"))));
}
