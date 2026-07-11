import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { formatDay } from "../site/day-format";
import { escapeHtml } from "../site/html";
import type { SlidePost } from "./data";

// The instagram carousel model: cover + the post's story slides + cta,
// rendered from the agent-scripted post in data/slides/{day}.json.
export interface CoverCard {
  kind: "cover";
  day: string;
  slot: "am" | "pm";
  hook: string;
}

export interface StoryCard {
  kind: "story";
  category: string;
  title: string;
  desc: string;
}

export interface CtaCard {
  kind: "cta";
}

export type SlideCard = CoverCard | StoryCard | CtaCard;

const MAX_HOOK = 120;
const MAX_TITLE = 120;
const MAX_DESC = 110;

// A truncated pair of pen markers would leak literal == onto the card.
const dropUnpairedMarks = (s: string): string => {
  let out = s;
  if (((out.match(/==/g) ?? []).length & 1) === 1) out = out.replace(/==/g, "");
  if ((out.match(/\(\(/g) ?? []).length !== (out.match(/\)\)/g) ?? []).length) {
    out = out.replace(/\(\(|\)\)/g, "");
  }
  return out;
};

const stripMarks = (s: string): string => s.replace(/==/g, "").replace(/\(\(|\)\)/g, "");

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const comma = cut.lastIndexOf(", ");
  const base = comma > max * 0.4 ? cut.slice(0, comma) : cut.slice(0, cut.lastIndexOf(" "));
  return `${base.trimEnd()}…`;
}

/** The renderable cards for one post; the caps are a defensive net, verify gates first. */
export function buildCards(day: string, post: SlidePost): SlideCard[] {
  return [
    { kind: "cover", day, slot: post.slot, hook: truncate(post.hook, MAX_HOOK) },
    ...post.slides.map(
      (slide): StoryCard => ({
        kind: "story",
        category: slide.category,
        title: dropUnpairedMarks(truncate(slide.title, MAX_TITLE)),
        desc: dropUnpairedMarks(truncate(slide.desc, MAX_DESC)),
      }),
    ),
    { kind: "cta" },
  ];
}

const MAX_ALT = 100;

/** Screen-reader text for a rendered card, capped to instagram's alt length. */
export function altText(card: SlideCard): string {
  if (card.kind === "cover") return truncate(`sift, ${formatDay(card.day)}: ${card.hook}`, MAX_ALT);
  if (card.kind === "story") return truncate(stripMarks(`${card.title}: ${card.desc}`), MAX_ALT);
  return "sift.yasint.dev: the day's tech, sifted twice daily";
}

export interface SlideMeta {
  day: string;
  slot: "am" | "pm";
  caption: string;
  hashtags: string[];
  cards: { file: string; alt: string }[];
}

/** The posting companion published beside a post's rendered pngs. */
export function slideMeta(day: string, post: SlidePost, cards: SlideCard[]): SlideMeta {
  return {
    day,
    slot: post.slot,
    caption: post.caption,
    hashtags: post.hashtags,
    cards: cards.map((card, i) => ({ file: `card-${i + 1}.png`, alt: altText(card) })),
  };
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
    fontFace("Cormorant Garamond", "cormorant.woff2", "500"),
    fontFace("Karla", "karla.woff2", "400"),
    fontFace("Space Mono", "space-mono.woff2", "400"),
  ].join("\n"));

// Fraunces for the wordmark, Cormorant Garamond for display, Karla for text,
// Space Mono for labels: the site's own pairing at poster scale.
const SHELL_CSS = `
*{margin:0;box-sizing:border-box}
html,body{width:1080px;height:1350px;overflow:hidden}
body{position:relative;background:#0d0c0b;color:#b8b0a3;font-family:Karla,sans-serif;
background-image:radial-gradient(circle,rgba(168,159,147,.06) 1.4px,transparent 1.9px);background-size:24px 24px;
display:flex;flex-direction:column;padding:88px}
.wordmark{font-family:Fraunces,Georgia,serif;font-weight:600;letter-spacing:-.02em;color:#e8e2d9}
.display{font-family:'Cormorant Garamond',Georgia,serif;font-weight:500;letter-spacing:-.005em;color:#e8e2d9;text-wrap:balance}
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
  const when = `${formatDay(card.day)}${card.slot === "pm" ? " &middot; evening" : ""}`;
  return `<div class="top"><span class="wordmark" style="font-size:88px">sift<span class="dot">.</span></span><span class="mono muted" style="font-size:30px">${when}</span></div>
<div style="margin:auto 0">
<p class="display" style="font-size:${fontSize(card.hook, 84, 74, 64)}px;line-height:1.22">${escapeHtml(card.hook)}<span class="dot">.</span></p>
<p class="mono muted" style="font-size:30px;margin-top:64px">swipe for the day's stories &rarr;</p>
</div>
<div class="bottom"><span style="font-size:32px" class="muted">the day's tech, sifted</span>${counter}</div>`;
}

function storyBody(card: StoryCard, counter: string): string {
  return `<div class="top"><span class="label">${escapeHtml(card.category)}</span>${counter}</div>
<div style="margin:auto 0">
<h1 class="display" style="font-size:${fontSize(card.title, 78, 68, 58)}px;line-height:1.2;margin-bottom:48px">${inline(card.title)}${card.title.endsWith("…") ? "" : '<span class="dot">.</span>'}</h1>
<p style="font-size:38px;line-height:1.5;color:#9a9184;max-width:820px;text-wrap:pretty">${inline(card.desc)}</p>
</div>
<div class="bottom"><span></span><span class="wordmark" style="font-size:40px">sift<span class="dot">.</span></span></div>`;
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

/** A scrollable browser preview of one post's carousel at thumbnail scale. */
export function renderSheetHtml(label: string, count: number): string {
  const frames = Array.from(
    { length: count },
    (_, i) => `<div class="card"><iframe src="card-${i + 1}.html" loading="lazy"></iframe></div>`,
  ).join("\n");
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>sift slides ${label}</title>
<style>
body{margin:0;background:#1a1816;color:#b8b0a3;font-family:system-ui;padding:32px}
h1{font-size:18px;font-weight:500;margin:0 0 24px}
.grid{display:flex;flex-wrap:wrap;gap:24px}
.card{width:378px;height:473px;overflow:hidden;border:1px solid #2a2622;border-radius:10px}
iframe{width:1080px;height:1350px;transform:scale(.35);transform-origin:0 0;border:0;pointer-events:none}
</style>
</head>
<body>
<h1>sift slides &middot; ${label} &middot; ${count} cards</h1>
<div class="grid">
${frames}
</div>
</body>
</html>
`;
}
