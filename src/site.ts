import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { marked } from "marked";

const BASE_URL = "https://sift.yasint.dev";
const BYLINE = '<span class="byline">by <a href="https://yasint.dev" data-backlink>yasin</a></span>';
const SITE_DESCRIPTION =
  "The day's tech, sifted: a twice-daily digest of AI, devtools, security and industry news, one readable page per day.";

interface Digest {
  day: string;
  title: string;
  description: string;
  body: string;
}

const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/'/g, "&#39;");

// Digest markdown is agent-authored but quotes feed-derived text; raw html
// passes through as escaped text, never as markup.
marked.use({
  renderer: {
    html(token: unknown): string {
      const t = token as { text?: string; raw?: string } | string;
      return escapeHtml(typeof t === "string" ? t : (t.text ?? t.raw ?? ""));
    },
  },
});

const FRONT = /^---\n([\s\S]*?)\n---\n?/;

function parseDigest(day: string, raw: string): Digest {
  const front = FRONT.exec(raw);
  const meta: Record<string, string> = {};
  for (const line of (front?.[1] ?? "").split("\n")) {
    const kv = /^(\w+):\s*"?(.*?)"?\s*$/.exec(line);
    if (kv) meta[kv[1]!] = kv[2]!;
  }
  return {
    day,
    title: meta.title ?? `sift: ${day}`,
    description: meta.description ?? "",
    body: raw.slice(front?.[0].length ?? 0),
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
      <p class="crumbs"><a href="index.html">&larr; all days</a>${BYLINE}</p>
      <h1>${escapeHtml(d.title)}</h1>
      <p class="meta">${formatDay(d.day)}</p>
      <article class="prose">${marked.parse(d.body) as string}</article>`;
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
      `<h1>sift<span class="dot">.</span> ${BYLINE}</h1><p class="tag">the day's tech, sifted</p>` +
        `<section id="today" class="today-note" hidden></section>${list}${todayScript()}`,
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

  return { pages: digests.length + 1 };
}

// Visitors clicking "read today's digest" land on the index with ?today=1.
// The site is static, so today's page may not exist yet; decide client-side:
// jump to it when it is in the list, otherwise say when the next one lands
// (digests are written around 06:00 and 18:30 Europe/Oslo).
function todayScript(): string {
  return `<script>
(() => {
  const now = new Date();
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Oslo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const clock = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Oslo", hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
  const todayLink = document.querySelector('.days a[href="' + day + '.html"]');
  if (todayLink) {
    if (new URLSearchParams(location.search).has("today")) location.replace(todayLink.getAttribute("href") + location.search);
    return;
  }
  const next = clock < "06:00" ? "around 06:00 today" : clock < "18:30" ? "around 18:30 today" : "around 06:00 tomorrow";
  const slot = document.getElementById("today");
  slot.innerHTML = "today's digest is still being sifted. the next one lands <strong>" + next + "</strong> (Oslo time); come back then, or read the recent days below.";
  slot.hidden = false;
})();
</script>`;
}

interface PageMeta {
  title: string;
  description: string;
  path: string;
  type: "website" | "article";
}

function page({ title, description, path, type }: PageMeta, body: string): string {
  const canonical = `${BASE_URL}/${path}`;
  const head = `<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${canonical}">
<meta property="og:site_name" content="sift">
<meta property="og:type" content="${type}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${canonical}">
<meta name="twitter:card" content="summary">
<meta name="theme-color" content="#0d0c0b">
<link rel="icon" type="image/svg+xml" href="favicons/favicon.svg">
<link rel="icon" type="image/x-icon" href="favicons/favicon.ico">
<link rel="icon" type="image/png" sizes="32x32" href="favicons/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="favicons/favicon-16x16.png">
<link rel="apple-touch-icon" sizes="180x180" href="favicons/apple-touch-icon.png">`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${head}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&family=Karla:wght@300..700&family=Space+Mono&display=swap">
<style>
:root{--bg:#0d0c0b;--surface:#16140f;--text:#e8e2d9;--muted:#7a7268;--accent:#d4976a;--accent-hover:#e8b08a;--border:#2a2622;--radius:9px}
*{box-sizing:border-box}
body{margin:0 auto;max-width:44rem;padding:3rem 1.25rem 5rem;background:var(--bg);color:var(--text);font:400 1rem/1.6 "Karla",ui-sans-serif,system-ui,sans-serif}
h1{font-family:"Fraunces",Georgia,serif;font-weight:600;font-size:2.1rem;letter-spacing:-.02em;margin:0 0 .25rem}
.dot{color:var(--accent)}
.tag{color:var(--muted);margin:0 0 2.5rem}
.mono{font-family:"Space Mono",ui-monospace,monospace;font-size:.85em}
.meta{color:var(--muted);font-size:.9rem;margin:.15rem 0 0}
.crumbs{margin:0 0 2rem;display:flex;justify-content:space-between;align-items:baseline;gap:1rem}
.byline{font-family:"Karla",ui-sans-serif,system-ui,sans-serif;font-weight:400;font-size:.9rem;letter-spacing:0;color:var(--muted)}
.byline a{color:#b8b0a3}
a{color:var(--accent);text-decoration:none}
a:hover{color:var(--accent-hover);text-decoration:underline}
.days{list-style:none;margin:0;padding:0}
.days li{padding:1rem 0;border-bottom:1px solid var(--border)}
.days a{font-size:1.05rem}
.prose{margin-top:2rem}
.prose h2{font-family:"Fraunces",Georgia,serif;font-weight:600;font-size:1.35rem;margin:2.2rem 0 .6rem;color:#d4cdc2}
.prose li{margin:.45rem 0}
.prose blockquote{margin:1rem 0;padding:.5rem 1rem;border-left:2px solid var(--accent);color:#b8b0a3}
.prose code{font-family:"Space Mono",ui-monospace,monospace;font-size:.85em;background:var(--surface);padding:.1em .35em;border-radius:4px}
.today-note{margin:0 0 1.5rem;padding:.85rem 1.1rem;border:1px solid var(--border);border-radius:var(--radius);color:#b8b0a3;font-size:.92rem}
.today-note strong{color:var(--accent);font-weight:600}
</style>
</head>
<body>
${body}
<script>
// Visitors arriving from yasint.dev carry ?from=<path>; remember it for the
// tab so the backlink returns them to the page they left, not the homepage.
const from = new URLSearchParams(location.search).get("from");
if (from && from.startsWith("/") && !from.startsWith("//")) sessionStorage.setItem("sift-from", from);
const back = sessionStorage.getItem("sift-from");
const link = document.querySelector("[data-backlink]");
if (link && back) link.href = "https://yasint.dev" + back;
</script>
</body>
</html>
`;
}

const invokedDirectly = process.argv[1]?.endsWith("site.ts");
if (invokedDirectly) {
  console.log(JSON.stringify(buildSite(resolve("."), resolve("site"))));
}
