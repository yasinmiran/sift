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
const MAX_WHY = 140;

const stripMarkup = (s: string): string =>
  s
    .replace(/==([^=\n]+?)==/g, "$1")
    .replace(/\(\(([^()\n]+?)\)\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)\s]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1");

function truncate(s: string, max = MAX_WHY): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(" ")).trimEnd()}…`;
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
      headline: stripMarkup(entry[1]!),
      why: truncate(why),
      source: source(entry[2]!),
    });
  }
  return [{ kind: "cover", day: digest.day, hook: digest.description }, ...stories, { kind: "cta" }];
}

// Fraunces for display, Karla for text, Space Mono for labels: the site's
// own pairing at poster scale.
const SHELL_CSS = `
*{margin:0;box-sizing:border-box}
html,body{width:1080px;height:1350px;overflow:hidden}
body{position:relative;background:#0d0c0b;color:#b8b0a3;font-family:Karla,sans-serif;
background-image:radial-gradient(circle,rgba(168,159,147,.06) 1.4px,transparent 1.9px);background-size:24px 24px;
display:flex;flex-direction:column;padding:88px}
.wordmark{font-family:Fraunces,Georgia,serif;font-weight:600;letter-spacing:-.02em;color:#e8e2d9}
.dot{color:#d4976a}
.mono{font-family:"Space Mono",monospace}
.top{display:flex;justify-content:space-between;align-items:baseline}
.bottom{display:flex;justify-content:space-between;align-items:baseline;margin-top:auto}
.count{font-family:"Space Mono",monospace;font-size:28px;color:#5c564e}
.label{font-family:"Space Mono",monospace;font-size:30px;letter-spacing:.08em;color:#d4976a}
.muted{color:#7a7268}
`;

const fontSize = (text: string, big: number, mid: number, small: number): number =>
  text.length > 180 ? small : text.length > 110 ? mid : big;

function coverBody(card: CoverCard, counter: string): string {
  return `<div class="top"><span class="wordmark" style="font-size:88px">sift<span class="dot">.</span></span><span class="mono muted" style="font-size:30px">${card.day}</span></div>
<p class="wordmark" style="font-size:${fontSize(card.hook, 66, 58, 50)}px;line-height:1.3;margin:auto 0;font-weight:500">${escapeHtml(card.hook)}</p>
<div class="bottom"><span style="font-size:32px" class="muted">the day's tech, sifted</span>${counter}</div>`;
}

function storyBody(card: StoryCard, counter: string): string {
  return `<div class="top"><span class="label">${escapeHtml(card.section.toLowerCase())}</span>${counter}</div>
<div style="margin:auto 0">
<h1 class="wordmark" style="font-size:${fontSize(card.headline, 68, 58, 50)}px;line-height:1.2;margin-bottom:44px">${escapeHtml(card.headline)}</h1>
<p style="font-size:40px;line-height:1.5">${escapeHtml(card.why)}</p>
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
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;600&family=Karla:wght@400&family=Space+Mono&display=block">
<style>${SHELL_CSS}</style>
</head>
<body>
${body}
</body>
</html>
`;
}
