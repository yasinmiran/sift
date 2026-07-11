import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { formatDay } from "../site/day-format";
import { escapeHtml } from "../site/html";

// The instagram carousel model: cover + up to four stories + cta, derived
// deterministically from one day's digest (see the 2026-07-11 slides spec).
export interface CoverCard {
  kind: "cover";
  day: string;
  hook: string;
}

export interface StoryCard {
  kind: "story";
  section: string;
  headline: string;
  why: string;
  source: string;
}

export interface CtaCard {
  kind: "cta";
}

export type SlideCard = CoverCard | StoryCard | CtaCard;

export interface DigestInput {
  day: string;
  title: string;
  description: string;
  body: string;
}

const SKIP_SECTIONS = new Set(["Hacker News", "Threads"]);
const ENTRY = /^- \[([^\]]+)\]\(([^)\s]+)\)(.*)$/;
const MAX_STORIES = 4;
const MAX_WHY = 110;
const MAX_HEADLINE = 120;
const MAX_HOOK = 120;

// Markdown comes off, pen marks stay: the renderer draws them as strokes.
const stripMarkup = (s: string): string =>
  s
    .replace(/\[([^\]]+)\]\([^)\s]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1");

// A truncated pair of pen markers would leak literal == onto the card.
const dropUnpairedMarks = (s: string): string => {
  let out = s;
  if (((out.match(/==/g) ?? []).length & 1) === 1) out = out.replace(/==/g, "");
  if ((out.match(/\(\(/g) ?? []).length !== (out.match(/\)\)/g) ?? []).length) {
    out = out.replace(/\(\(|\)\)/g, "");
  }
  return out;
};

function truncate(s: string, max = MAX_WHY): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const comma = cut.lastIndexOf(", ");
  const base = comma > max * 0.4 ? cut.slice(0, comma) : cut.slice(0, cut.lastIndexOf(" "));
  return `${base.trimEnd()}…`;
}

// One thing on the cover: the description's first clause (two when the
// first is a short name), no trailing punctuation.
function coverHook(description: string): string {
  const parts = description.split(", ");
  const hook = parts[0]!.length < 40 && parts.length > 1 ? `${parts[0]!}, ${parts[1]!}` : parts[0]!;
  return truncate(hook.replace(/[.,;]\s*$/, ""), MAX_HOOK);
}

function source(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function slideCards(digest: DigestInput): SlideCard[] {
  const stories: StoryCard[] = [];
  let section: string | null = null;
  let sectionUsed = true;
  for (const line of digest.body.split("\n")) {
    const heading = /^##\s+(.+?)\s*$/.exec(line);
    if (heading) {
      section = heading[1]!;
      sectionUsed = false;
      continue;
    }
    if (section === null || sectionUsed || SKIP_SECTIONS.has(section) || stories.length >= MAX_STORIES) continue;
    const entry = ENTRY.exec(line);
    if (!entry) continue;
    sectionUsed = true;
    // one thing per slide: the first clause explains, the rest stays on the site
    const why = stripMarkup(entry[3]!.trim().replace(/^[:.,;]\s*/, ""))
      .split(/;\s/)[0]!
      .replace(/[,;]\s*$/, "");
    stories.push({
      kind: "story",
      section,
      headline: truncate(stripMarkup(entry[1]!), MAX_HEADLINE),
      why: dropUnpairedMarks(truncate(why)),
      source: source(entry[2]!),
    });
  }
  return [{ kind: "cover", day: digest.day, hook: coverHook(digest.description) }, ...stories, { kind: "cta" }];
}

// Fonts ride inside every card as base64 woff2 so rendering never depends
// on the network and never falls back to a system serif.
let fontCss: string | null = null;
const fontFace = (family: string, file: string, weight: string): string => {
  const data = readFileSync(fileURLToPath(new URL(`fonts/${file}`, import.meta.url))).toString("base64");
  return `@font-face{font-family:'${family}';src:url(data:font/woff2;base64,${data}) format('woff2');font-weight:${weight};font-style:normal}`;
};
const fonts = (): string =>
  (fontCss ??= [
    fontFace("Fraunces", "fraunces.woff2", "500 600"),
    fontFace("Karla", "karla.woff2", "400"),
    fontFace("Space Mono", "space-mono.woff2", "400"),
  ].join("\n"));

// Fraunces for display, Karla for text, Space Mono for labels: the site's
// own pairing at poster scale.
const SHELL_CSS = `
*{margin:0;box-sizing:border-box}
html,body{width:1080px;height:1350px;overflow:hidden}
body{position:relative;background:#0d0c0b;color:#b8b0a3;font-family:Karla,sans-serif;
background-image:radial-gradient(circle,rgba(168,159,147,.06) 1.4px,transparent 1.9px);background-size:24px 24px;
display:flex;flex-direction:column;padding:88px}
.wordmark{font-family:Fraunces,Georgia,serif;font-weight:600;letter-spacing:-.02em;color:#e8e2d9}
.display{font-family:Fraunces,Georgia,serif;font-weight:500;font-variation-settings:'opsz' 84;letter-spacing:-.015em;color:#e8e2d9;text-wrap:balance}
.pen-u{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 12' preserveAspectRatio='none'%3E%3Cpath d='M3 8 C 20 4, 38 10, 58 7 S 95 9, 117 5' fill='none' stroke='%23d4976a' stroke-width='2.6' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-size:100% .5em;background-position:0 103%;padding-bottom:.1em}
.pen-o{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 44' preserveAspectRatio='none'%3E%3Cpath d='M60 3 C 94 1, 118 11, 117 22 C 116 34, 90 42, 56 41 C 24 40, 2 33, 2 21 C 2 10, 28 2, 76 3' fill='none' stroke='%23d4976a' stroke-width='2.4' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-size:100% 100%;padding:.2em .5em;margin:0 .08em}
.dot{color:#d4976a}
.mono{font-family:"Space Mono",monospace}
.top{display:flex;justify-content:space-between;align-items:baseline}
.bottom{display:flex;justify-content:space-between;align-items:baseline;margin-top:auto}
.count{font-family:"Space Mono",monospace;font-size:28px;color:#5c564e}
.label{font-family:"Space Mono",monospace;font-size:30px;letter-spacing:.08em;color:#d4976a}
.muted{color:#7a7268}
`;

const fontSize = (text: string, big: number, mid: number, small: number): number =>
  text.length > 100 ? small : text.length > 60 ? mid : big;

// Escape first, then let surviving pen marks become hand-drawn strokes.
const inline = (text: string): string =>
  escapeHtml(text)
    .replace(/==([^=\n]+?)==/g, '<span class="pen-u">$1</span>')
    .replace(/\(\(([^()\n]+?)\)\)/g, '<span class="pen-o">$1</span>');

function coverBody(card: CoverCard, counter: string): string {
  return `<div class="top"><span class="wordmark" style="font-size:88px">sift<span class="dot">.</span></span><span class="mono muted" style="font-size:30px">${formatDay(card.day)}</span></div>
<div style="margin:auto 0">
<p class="display" style="font-size:${fontSize(card.hook, 78, 68, 58)}px;line-height:1.25">${escapeHtml(card.hook)}<span class="dot">.</span></p>
<p class="mono muted" style="font-size:30px;margin-top:64px">swipe for the day's stories &rarr;</p>
</div>
<div class="bottom"><span style="font-size:32px" class="muted">the day's tech, sifted</span>${counter}</div>`;
}

function storyBody(card: StoryCard, counter: string): string {
  return `<div class="top"><span class="label">${escapeHtml(card.section.toLowerCase())}</span>${counter}</div>
<div style="margin:auto 0">
<h1 class="display" style="font-size:${fontSize(card.headline, 72, 62, 52)}px;line-height:1.22;margin-bottom:48px">${escapeHtml(card.headline)}${card.headline.endsWith("…") ? "" : '<span class="dot">.</span>'}</h1>
<p style="font-size:38px;line-height:1.5;color:#9a9184;max-width:820px;text-wrap:pretty">${inline(card.why)}</p>
</div>
<div class="bottom"><span class="mono muted" style="font-size:28px">${escapeHtml(card.source)}</span><span class="wordmark" style="font-size:40px">sift<span class="dot">.</span></span></div>`;
}

function ctaBody(counter: string): string {
  return `<div class="top"><span class="wordmark" style="font-size:56px">sift<span class="dot">.</span></span>${counter}</div>
<div style="margin:auto 0;text-align:center">
<div style="width:120px;height:120px;border-radius:50%;background:#d4976a;margin:0 auto 64px"></div>
<p class="wordmark" style="font-size:72px;margin-bottom:40px">the full day, every day</p>
<p style="font-size:44px;color:#d4976a;margin-bottom:28px">sift.yasint.dev</p>
<p class="mono muted" style="font-size:30px">@sifted.dev &middot; twice daily &middot; 06:45 &amp; 18:45 oslo</p>
</div>
<div class="bottom"><span style="font-size:30px" class="muted">free &middot; rss &middot; push notifications</span></div>`;
}

/** One self-contained html document per card, 1080x1350. */
export function renderSlideHtml(card: SlideCard, index: number, total: number): string {
  const counter = `<span class="count">${index + 1}/${total}</span>`;
  const body =
    card.kind === "cover" ? coverBody(card, counter) : card.kind === "story" ? storyBody(card, counter) : ctaBody(counter);
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>${fonts()}${SHELL_CSS}</style>
</head>
<body>
${body}
</body>
</html>
`;
}

/** A scrollable browser preview of the whole carousel at thumbnail scale. */
export function renderSheetHtml(day: string, count: number): string {
  const frames = Array.from(
    { length: count },
    (_, i) => `<div class="card"><iframe src="card-${i + 1}.html" loading="lazy"></iframe></div>`,
  ).join("\n");
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>sift slides ${day}</title>
<style>
body{margin:0;background:#1a1816;color:#b8b0a3;font-family:system-ui;padding:32px}
h1{font-size:18px;font-weight:500;margin:0 0 24px}
.grid{display:flex;flex-wrap:wrap;gap:24px}
.card{width:378px;height:473px;overflow:hidden;border:1px solid #2a2622;border-radius:10px}
iframe{width:1080px;height:1350px;transform:scale(.35);transform-origin:0 0;border:0;pointer-events:none}
</style>
</head>
<body>
<h1>sift slides &middot; ${day} &middot; ${count} cards</h1>
<div class="grid">
${frames}
</div>
</body>
</html>
`;
}
