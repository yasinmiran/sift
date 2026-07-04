// The shared page chrome: html shell, SEO head, design tokens and the
// backlink script every page carries.
import { escapeHtml } from "./html";

export const BASE_URL = "https://sift.yasint.dev";
export const BYLINE =
  '<span class="byline">by <a href="https://yasint.dev" data-backlink>yasin</a></span>';
export const SITE_DESCRIPTION =
  "The day's tech, sifted: a twice-daily digest of AI, devtools, security and industry news, one readable page per day.";

export interface PageMeta {
  title: string;
  description: string;
  path: string;
  type: "website" | "article";
  noindex?: true;
}

export function page({ title, description, path, type, noindex }: PageMeta, body: string): string {
  const canonical = `${BASE_URL}/${path}`;
  const head = `<title>${escapeHtml(title)}</title>
${noindex ? '<meta name="robots" content="noindex">\n' : ""}<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${canonical}">
<meta property="og:site_name" content="sift">
<meta property="og:type" content="${type}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${canonical}">
<meta name="twitter:card" content="summary">
<meta name="theme-color" content="#0d0c0b">
<link rel="icon" type="image/svg+xml" href="/favicons/favicon.svg">
<link rel="icon" type="image/x-icon" href="/favicons/favicon.ico">
<link rel="icon" type="image/png" sizes="32x32" href="/favicons/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicons/favicon-16x16.png">
<link rel="apple-touch-icon" sizes="180x180" href="/favicons/apple-touch-icon.png">`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${head}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,200..900;1,9..144,200..900&family=Karla:ital,wght@0,300..700;1,300..700&family=Space+Mono:ital,wght@0,400;0,700;1,400;1,700&display=swap">
<style>
/* Type, palette and substrate mirror yasint.dev (its tailwind theme + global.css). */
:root{--bg:#0d0c0b;--surface:#1a1816;--text:#e8e2d9;--body:#b8b0a3;--bold:#d4cdc2;--muted:#7a7268;--faint:#5c564e;--accent:#d4976a;--accent-hover:#e8b08a;--border:#2a2622;--radius:9px}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
@media (min-width:1536px){html{font-size:19px}}
body{margin:0 auto;max-width:44rem;padding:3rem 1.25rem 5rem;background:var(--bg);color:var(--body);font:400 1rem/1.6 "Karla",ui-sans-serif,system-ui,sans-serif;background-image:radial-gradient(circle,rgba(168,159,147,.045) 1px,transparent 1.3px);background-size:22px 22px}
body::before{content:"";position:fixed;inset:0;z-index:9999;pointer-events:none;opacity:.025;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");background-repeat:repeat;background-size:256px 256px}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:2px}
h1{font-family:"Fraunces",Georgia,serif;font-weight:600;font-size:2.1rem;letter-spacing:-.02em;margin:0 0 .25rem;color:var(--text)}
.dot{color:var(--accent)}
.tag{color:var(--muted);margin:0 0 2.5rem}
.mono{font-family:"Space Mono",ui-monospace,monospace;font-size:.85em}
.meta{color:var(--muted);font-size:.9rem;margin:.15rem 0 0}
.crumbs{margin:0 0 2rem;display:flex;justify-content:space-between;align-items:baseline;gap:1rem}
.byline{font-family:"Karla",ui-sans-serif,system-ui,sans-serif;font-weight:400;font-size:.9rem;letter-spacing:0;color:var(--muted)}
.byline a{color:var(--body)}
a{color:var(--accent);text-decoration:none;transition:color .2s}
a:hover{color:var(--accent-hover)}
.days{list-style:none;margin:0;padding:0}
.days li{padding:1rem 0;border-bottom:1px solid var(--border)}
.days a{font-size:1.05rem}
.prose{margin-top:2rem;line-height:1.72}
.prose p{margin:1.5em 0}
.prose a{border-bottom:1px dotted var(--faint);transition:color .2s,border-color .2s}
.prose a:hover{border-bottom-color:var(--accent)}
.prose h2{font-family:"Fraunces",Georgia,serif;font-weight:600;font-size:1.35rem;margin:2.2rem 0 .6rem;color:var(--text);letter-spacing:-.01em}
.prose li{margin:.45rem 0}
.prose ul li::marker{color:var(--faint)}
.prose ol li::marker{color:var(--muted)}
.prose strong{color:var(--bold)}
.prose blockquote{margin:1rem 0;padding:.5rem 1rem;border-left:2px solid var(--accent);color:var(--bold)}
.prose code{font-family:"Space Mono",ui-monospace,monospace;font-size:.85em;background:var(--surface);color:var(--accent);padding:.1em .35em;border:1px solid var(--border);border-radius:4px}
.today-note{margin:0 0 1.5rem;padding:.85rem 1.1rem;border:1px solid var(--border);border-radius:var(--radius);color:var(--body);font-size:.92rem}
.today-note strong{color:var(--accent);font-weight:600}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
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
