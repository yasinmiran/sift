// The shared page chrome: html shell, SEO head, design tokens and the
// backlink script every page carries.
import { escapeHtml } from "./html";

export const BASE_URL = "https://sift.yasint.dev";
export const REPO_URL = "https://github.com/yasinmiran/sift";
export const GOATCOUNTER_URL = "https://yasin.goatcounter.com";
export const PUSH_URL = "https://sift-push.netlify.app";
export const VAPID_PUBLIC_KEY =
  "BOof2eUjrc1IGkMGlqiRdfB39JYdGHUK-D5GKt1TkxuaO169sUgmgpOWbdilWLVRhBufODdaBgluq3QDS-Bk9AY";
const BYLINE =
  '<span class="byline">by <a href="https://yasint.dev" data-backlink>yasin</a></span>';
// The webfont stylesheet is the page's only render-blocking request, so it
// decides when anything paints. It ships as a preload flipped to a stylesheet
// on arrival: the page paints in the fallback stacks straight away and swaps
// when the webfonts land, which is what display=swap already asks for. The
// noscript copy keeps the plain blocking link for readers without js.
const FONT_CSS =
  "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,200..900;1,9..144,200..900&family=Karla:ital,wght@0,300..700;1,300..700&family=Space+Mono:ital,wght@0,400;0,700;1,400;1,700&display=swap";
const footer = (note?: string) => `<footer class="foot">
${BYLINE} &middot; <a class="feed" href="/feed.xml">rss</a>
<p class="foot-note">curated daily with help of AI; mistakes are unlikely, but possible. see <a href="${REPO_URL}/blob/main/AGENTS.md">AGENTS.md</a> for how it works.</p>
${note ? `<p class="foot-note">${note}</p>\n` : ""}</footer>`;
export const SITE_DESCRIPTION =
  "The day's tech, sifted: a twice-daily digest of AI, devtools, security and industry news, one readable page per day.";

export interface PageMeta {
  title: string;
  description: string;
  path: string;
  type: "website" | "article";
  noindex?: true;
  footNote?: string;
  published?: string;
  modified?: string;
  jsonLd?: Record<string, unknown>;
}

export function page(
  { title, description, path, type, noindex, footNote, published, modified, jsonLd }: PageMeta,
  body: string,
): string {
  const canonical = `${BASE_URL}/${path}`;
  const head = `<title>${escapeHtml(title)}</title>
${noindex ? '<meta name="robots" content="noindex">\n' : ""}<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${canonical}">
<meta property="og:site_name" content="sift">
<meta property="og:type" content="${type}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${BASE_URL}/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="sift: the day's tech, sifted">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${BASE_URL}/og.png">
${published ? `<meta property="article:published_time" content="${published}">\n` : ""}${
    modified && modified !== published ? `<meta property="article:modified_time" content="${modified}">\n` : ""
  }<meta name="theme-color" content="#0d0c0b">
<link rel="icon" type="image/svg+xml" href="/favicons/favicon.svg">
<link rel="icon" type="image/x-icon" href="/favicons/favicon.ico">
<link rel="icon" type="image/png" sizes="32x32" href="/favicons/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicons/favicon-16x16.png">
<link rel="apple-touch-icon" sizes="180x180" href="/favicons/apple-touch-icon.png">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="alternate" type="application/rss+xml" title="sift" href="/feed.xml">${
    jsonLd ? `\n<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>` : ""
  }`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${head}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preload" as="style" href="${FONT_CSS}" onload="this.rel='stylesheet'">
<noscript><link rel="stylesheet" href="${FONT_CSS}"></noscript>
<style>
/* Type, palette and substrate mirror yasint.dev (its tailwind theme + global.css). */
:root{color-scheme:dark;--bg:#0d0c0b;--surface:#1a1816;--text:#e8e2d9;--body:#b8b0a3;--bold:#d4cdc2;--muted:#7a7268;--faint:#5c564e;--accent:#d4976a;--accent-hover:#e8b08a;--border:#2a2622;--radius:9px}
*{box-sizing:border-box}
/* The font css above is not render-blocking, so every cold load paints the
   prose in the fallback stack and re-wraps it when Karla arrives: 137 to
   330px of movement on 16 of 16 day page readings, layout shift past the 0.1
   good threshold on 13 of 20. Karla runs 2.1% wider than Arial over the
   month's 1,144 digest lines and carries no line gap, so an Arial-keyed face
   scaled to it wraps where Karla wraps. Bold needs a face of its own: one
   face answers weight 700 with the regular glyphs. Latin-1 and no more,
   because Karla draws all of that range and none of the chrome's arrows,
   which stay with the stacks below; a reader with neither local name
   (android, most linux) loads no face and is where they were before. */
@font-face{font-family:"Karla fallback";src:local("Arial"),local("Liberation Sans");size-adjust:102.1%;ascent-override:90.1%;descent-override:24.5%;line-gap-override:0%;unicode-range:U+0-FF}
@font-face{font-family:"Karla fallback";font-weight:700;src:local("Arial Bold"),local("Liberation Sans Bold");size-adjust:99.4%;ascent-override:92.6%;descent-override:25.2%;line-gap-override:0%;unicode-range:U+0-FF}
html{scroll-behavior:smooth}
@media (min-width:1536px){html{font-size:19px}}
body{margin:0 auto;max-width:44rem;padding:3rem 1.25rem 5rem;background:var(--bg);color:var(--body);font:400 1rem/1.6 "Karla","Karla fallback",ui-sans-serif,system-ui,sans-serif;background-image:radial-gradient(circle,rgba(168,159,147,.045) 1px,transparent 1.3px);background-size:22px 22px}
body::before{content:"";position:fixed;inset:0;z-index:9999;pointer-events:none;opacity:.025;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");background-repeat:repeat;background-size:256px 256px}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:2px}
h1{font-family:"Fraunces",Georgia,serif;font-weight:600;font-size:2.1rem;letter-spacing:-.02em;margin:0 0 .25rem;color:var(--text)}
.dot{color:var(--accent)}
.head{display:flex;justify-content:space-between;align-items:center;gap:1rem 1.5rem;flex-wrap:wrap;margin:0 0 2.5rem}
.tag{color:var(--muted);margin:0}
.mono{font-family:"Space Mono",ui-monospace,monospace;font-size:.85em}
.meta{color:var(--muted);font-size:.9rem;margin:.15rem 0 0}
.crumbs{margin:0 0 2rem}
.pager{display:flex;gap:1.5rem;margin:3.5rem 0 0;padding-top:1.5rem;border-top:1px solid var(--border);font-size:.95rem}
.pager a{display:flex;flex-direction:column;gap:.15rem}
.pager .later{margin-left:auto;text-align:right}
.pager .mono{color:var(--body);transition:color .2s}
.pager a:hover .mono{color:var(--accent-hover)}
.byline{font-size:.9rem;color:var(--muted)}
.byline a{color:var(--body)}
.feed{font-size:.9rem}
.foot{margin-top:4.5rem}
.foot-note{margin:.4rem 0 0;max-width:60%;font-size:.7rem;color:var(--muted)}
.foot-note a{color:var(--muted);text-decoration:underline dotted var(--faint);text-underline-offset:2px}
a{color:var(--accent);text-decoration:none;transition:color .2s}
a:hover{color:var(--accent-hover)}
.hero{display:block;margin:0 0 1.5rem;padding:0 0 2rem;border-bottom:1px solid var(--border)}
.hero .when{margin:0 0 .5rem;font-family:"Space Mono",ui-monospace,monospace;font-size:.8rem;color:var(--accent)}
.hero .desc{margin:0;font-family:"Fraunces",Georgia,serif;font-weight:500;font-size:1.35rem;line-height:1.45;letter-spacing:-.01em;color:var(--text);transition:color .2s}
.hero:hover .desc{color:var(--accent-hover)}
.hero .read{display:inline-block;margin:.8rem 0 0;font-size:.9rem;color:var(--accent)}
.days{list-style:none;margin:0;padding:0}
.days li{border-bottom:1px solid var(--border)}
.days li:last-child{border-bottom:none}
/* The row is the link, same as .hero: the padding lives on the anchor so the
   description under the date is part of the target rather than beside it. */
.days a{display:block;padding:1rem 0;font-size:1.05rem}
.prose{margin-top:2rem;line-height:1.72}
.prose p{margin:1.5em 0}
.prose a{border-bottom:1px dotted var(--faint);overflow-wrap:break-word;transition:color .2s,border-color .2s}
.prose a:hover{border-bottom-color:var(--accent)}
.prose h2{font-family:"Fraunces",Georgia,serif;font-weight:600;font-size:1.35rem;margin:2.2rem 0 .6rem;color:var(--text);letter-spacing:-.01em}
.prose li{margin:.45rem 0}
.prose ul li::marker{color:var(--faint)}
.prose ol li::marker{color:var(--muted)}
.prose strong{color:var(--bold)}
.prose blockquote{margin:1rem 0;padding:.5rem 1rem;border-left:2px solid var(--accent);color:var(--bold)}
mark.pen{background-color:transparent;color:var(--bold)}
.pen-u{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 12' preserveAspectRatio='none'%3E%3Cpath d='M3 8 C 20 4, 38 10, 58 7 S 95 9, 117 5' fill='none' stroke='%23d4976a' stroke-width='2.6' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-size:100% .5em;background-position:0 103%;padding-bottom:.1em}
.pen-o{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 44' preserveAspectRatio='none'%3E%3Cpath d='M60 3 C 94 1, 118 11, 117 22 C 116 34, 90 42, 56 41 C 24 40, 2 33, 2 21 C 2 10, 28 2, 76 3' fill='none' stroke='%23d4976a' stroke-width='2.4' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-size:100% 100%;padding:.28em .65em;margin:0 .1em}
.prose code{font-family:"Space Mono",ui-monospace,monospace;font-size:.85em;background:var(--surface);color:var(--accent);padding:.1em .35em;border:1px solid var(--border);border-radius:4px}
.today-note{margin:0 0 1.5rem;padding:.85rem 1.1rem;border:1px solid var(--border);border-radius:var(--radius);color:var(--body);font-size:.92rem}
.refresh-note{margin:1.4rem 0 0;transition:opacity .6s ease;position:relative;overflow:hidden}
.refresh-note::after{content:"";position:absolute;left:0;bottom:0;height:2px;width:100%;background:var(--accent);transform-origin:left;transform:scaleX(0)}
.refresh-note.draining::after{animation:drain 5.5s linear forwards}
@keyframes drain{from{transform:scaleX(1)}to{transform:scaleX(0)}}
@media (prefers-reduced-motion:reduce){.refresh-note{transition:none}.refresh-note.draining::after{animation:none}}
.today-note strong{color:var(--accent);font-weight:600}
.notify{margin:0;font-size:.9rem;color:var(--muted);display:flex;align-items:center;flex-wrap:wrap;gap:.6rem}
.notify[hidden]{display:none}
.notify-btn{font:inherit;font-size:.9rem;color:var(--body);background:none;border:1px solid var(--border);border-radius:var(--radius);padding:.4rem .8rem;cursor:pointer;transition:border-color .2s,color .2s;display:inline-flex;align-items:center;gap:.45rem}
/* Same guard as .notify above, and for the same reason: an author display
   declaration beats the ua sheet's [hidden]{display:none} whatever the
   specificity, so .notify-btn's inline-flex was laying out the install
   button notify.ts builds hidden. It shipped visible and dead on every
   load (its own handler returns until the browser offers the install
   event) and, 120px wide beside the bell, took .notify to 241px: past
   .head's wrap point under ~480px, so the archive dropped 54px when the
   bell landed. The day pages assert this sheet never names that event. */
.notify-btn[hidden]{display:none}
.notify-btn svg{width:15px;height:15px}
.notify-btn:active{transform:translateY(1px);border-color:var(--accent)}
.notify-btn:disabled{cursor:default;color:var(--muted)}
/* :hover matches a disabled button, :active does not, so the guard belongs in
   the selector. The sheet's earlier answer undid hover one declaration at a
   time and named border-color only, so the installed chip and every in-flight
   click lit --muted 4.13:1 -> --bold 12.39:1 under the pointer while reading
   dead everywhere else. :not() means a later declaration cannot leak either. */
.notify-btn:not(:disabled):hover{border-color:var(--accent);color:var(--bold)}
.notify-btn.busy{opacity:.55;cursor:progress}
.notify-btn .spin{animation:spin .9s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.notify-btn .spin{animation:none}}
/* The ios-only notify path (notify.ts, no PushManager): --muted measured
   4.13:1 here and 3.74:1 on the dialog's --surface below, both under AA. */
.notify-hint{font:inherit;font-size:.9rem;color:var(--body);background:none;border:none;padding:0;cursor:pointer;text-align:left;text-decoration:underline dotted var(--faint);text-underline-offset:3px}
.notify-hint:hover{color:var(--text)}
.install-help{background:var(--surface);color:var(--body);border:1px solid var(--border);border-radius:var(--radius);padding:1.5rem;max-width:22rem;font-size:.95rem}
.install-help::backdrop{background:rgba(0,0,0,.6)}
.install-help h2{font-family:"Fraunces",Georgia,serif;font-weight:600;color:var(--text);font-size:1.15rem;margin:0 0 .8rem}
.install-help ol{margin:0 0 1rem;padding-left:1.2rem}
.install-help li{margin:.4rem 0}
/* No colour: inherits the dialog's --body, 8.24:1. See .notify-hint. */
.help-note{font-size:.85rem;margin:0 0 1.2rem}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
/* Paper is the surface the palette cannot carry: chrome prints with
   background graphics off, so the sheet is white while every colour stays as
   declared -- --text at 1.29:1 against it, --bold 1.58, --body 2.15, --accent
   2.49. The same ten hexes read the other way round, no new colour, with
   --muted/--faint swapped because on paper the lighter one is the quieter.
   For the reader who does tick backgrounds on, background:none is half of
   it: color-scheme stays dark otherwise, so the ua canvas prints #121212 and
   the re-inked palette lands on it at 1.06:1. The scheme flips with the
   hexes. Hidden: navigation that cannot be followed, a button that
   cannot be tapped, and the view-time notes (.today-note covers
   .refresh-note), stale the moment they are printed. */
@media print{
:root{color-scheme:light;--text:#0d0c0b;--bold:#0d0c0b;--body:#1a1816;--muted:#5c564e;--faint:#7a7268;--accent:#0d0c0b;--accent-hover:#0d0c0b;--border:#b8b0a3}
body{max-width:none;padding:0;background:none}
body::before{display:none}
.crumbs,.pager,.notify,.today-note{display:none}
.prose code{background:none}
}
/* The pen marks are background images, so the two surfaces that are not a
   screen both drop them and the one phrase a day is meant to stop on reads
   as ordinary text: chrome prints backgrounds off, and forced-colors
   repaints to the reader's own two colours. currentColor is already the
   re-inked --bold on paper and the system text colour in high contrast, so
   the scribble becomes a rule and the circle an outline, no new hex. */
@media print,(forced-colors:active){
.pen-u{background-image:none;border-bottom:2px solid currentColor}
.pen-o{background-image:none;border:1.5px solid currentColor;border-radius:1.2em}
}
</style>
</head>
<body>
${body}
${footer(footNote)}
<script>
// First, because notify.ts waits on navigator.serviceWorker.ready to un-hide
// the bell at all: nothing below may be able to stop this line being reached.
if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js");
// Visitors arriving from yasint.dev carry ?from=<path>; remember it for the
// tab so the backlink returns them to the page they left, not the homepage.
// Where the reader denies site data the accessor itself throws, so both ends
// are guarded the way notify.ts guards its own localStorage. Returning
// someone to the page they left is a nicety; the worker is the product.
const from = new URLSearchParams(location.search).get("from");
if (from && from.startsWith("/") && !from.startsWith("//")) {
  try { sessionStorage.setItem("sift-from", from); } catch {}
}
let back = null;
try { back = sessionStorage.getItem("sift-from"); } catch {}
const link = document.querySelector("[data-backlink]");
if (link && back) link.href = "https://yasint.dev" + back;
// Installed apps resume from a snapshot with no refresh affordance; reload
// on foreground when the copy is likely stale. Browser tabs keep their state.
if (matchMedia("(display-mode: standalone)").matches || navigator.standalone === true) {
  let hiddenAt = 0;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") { hiddenAt = Date.now(); return; }
    if (hiddenAt && Date.now() - hiddenAt > 15 * 60000) location.reload();
  });
}
</script>
<script data-goatcounter="${GOATCOUNTER_URL}/count" async src="//gc.zgo.at/count.js"></script>
</body>
</html>
`;
}
