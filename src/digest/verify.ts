import * as cheerio from "cheerio";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { daysBefore, today } from "../day";
import { truncate } from "../pipeline/adapters/clean";
import { readPicks } from "../pipeline/picks";
import { SEEN_DAYS } from "../pipeline/state";
import { renderMarkdown } from "../site/markdown";
import { readHashtagPool, readSlidePosts } from "../slides/data";
import { parseFrontmatter } from "./frontmatter";

interface DayItem {
  url?: string;
  sourceSlug?: string;
  externalId?: string;
}

export interface VerifyResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

const MARK_U = /==[^=\n]+?==/g;
const MARK_O = /\(\([^()\n]+?\)\)/g;

const normalize = (url: string): string => url.replace(/\/+$/, "");

// What counts as "the digest's links" has to be what the page publishes.
// marked autolinks a bare url sitting in the prose, so a story written
// "title (https://url)" ships as a real anchor that the `](url)` form never
// mentions: 2026-09-19's Hacker News section did that nine times and every
// check below skipped all nine. Rendering the body and reading the hrefs is
// how the two are kept the same, and it beats re-deriving marked's autolink
// rules here — this is the html the site serves.
interface PublishedLink {
  url: string;
  /** The link's visible text is its own url, so it reads as a url, not words. */
  bare: boolean;
}

function publishedLinks(body: string): PublishedLink[] {
  const $ = cheerio.load(renderMarkdown(body));
  return $("a[href]")
    .map((_, el) => {
      const url = $(el).attr("href")!;
      return { url, bare: $(el).text().trim() === url };
    })
    .get();
}

// Threads and Hacker News are the two sections whose bullets are not entries.
// Threads maps the day's stories onto each other and AGENTS.md asks those
// bullets to name the entries they connect, not to link them: 26 of them
// across 2026-09-25..29 carry no link on purpose. Hacker News is prose, so it
// has no list items at all and is named here for the day one of them starts
// with a list. Matched on the heading's own words, the way the Threads and
// Hacker News section checks below are.
const PROSE_SECTIONS = ["threads", "hacker news"];

// AGENTS.md: "Every entry links inline to its best source url". The whole-body
// check above only asks whether a digest links anything, so an entry that
// leans on the one above it ("Bitget's hack (above) hit hot and warm wallets")
// or follows up a previous day can ship with nothing for the reader to follow.
// Reads the rendered body for the same reason publishedLinks does: an
// autolinked bare url is a link on the page, so it counts as one here.
function linklessEntries(body: string): string[] {
  const $ = cheerio.load(renderMarkdown(body));
  const entries: string[] = [];
  $("li").each((_, el) => {
    if ($(el).find("a[href]").length > 0) return;
    // A digest renders flat, one h2 per section followed by its list, so the
    // section an entry sits in is the h2 before the list it belongs to.
    const list = $(el).parentsUntil("body").last();
    const section = list.prevAll("h2").first().text().trim().toLowerCase();
    if (PROSE_SECTIONS.some((name) => section.startsWith(name))) return;
    entries.push($(el).text().replace(/\s+/g, " ").trim());
  });
  return entries;
}

// A hacker news story is ingested under the article's own url, so a digest
// that links the discussion instead reads as a link outside the day's items
// unless the permalink form is admitted too. The id is the item's
// externalId (algolia's objectID), and hacker-news is the only source that
// keys items by a bare number.
const HN_PERMALINK = "https://news.ycombinator.com/item?id=";
const hnPermalinks = (items: DayItem[]): string[] =>
  items
    .filter((i) => i.sourceSlug === "hacker-news" && /^\d+$/.test(i.externalId ?? ""))
    .map((i) => `${HN_PERMALINK}${i.externalId}`);

// A digest links stories from the day's items, but not only: a follow-up, or
// an evening rewrite reaching back, can carry yesterday's story into today's
// prose. That url is in no items file of this day and is not a typo either,
// so the archive is asked before the warning is written. SEEN_DAYS is the
// pipeline's own dedup horizon (state.ts) — an item cannot re-enter a later
// day inside it — which makes it the window where "sift has this story"
// still means something. Maps a url to the most recent day that ingested it.
function carriedOver(rootDir: string, day: string): Map<string, string> {
  const ingested = new Map<string, string>();
  for (let n = SEEN_DAYS; n >= 1; n--) {
    const past = daysBefore(day, n);
    const path = join(rootDir, "data", "items", `${past}.json`);
    if (!existsSync(path)) continue;
    let items: DayItem[];
    try {
      items = JSON.parse(readFileSync(path, "utf8")).items as DayItem[];
      if (!Array.isArray(items)) continue;
    } catch {
      continue; // an unreadable past day is that day's verify run to report
    }
    for (const url of [...items.map((i) => i.url).filter(Boolean), ...hnPermalinks(items)]) {
      ingested.set(normalize(url!), past);
    }
  }
  return ingested;
}

// Checks a written digest against the digest contract in AGENTS.md: errors
// break the site or the archive and must be fixed; warnings need judgment
// (a link outside the day's items is fine when it is a deliberate primary
// source, not fine when it is a typo or an invented url).
export function verifyDigest(rootDir: string, day: string): VerifyResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const path = join(rootDir, "digests", `${day}.md`);
  if (!existsSync(path)) {
    return { ok: false, errors: [`digests/${day}.md does not exist`], warnings };
  }
  const raw = readFileSync(path, "utf8");

  const { meta, body: rawBody } = parseFrontmatter(raw);
  if (!meta) {
    errors.push("missing frontmatter block");
  } else {
    for (const key of ["title", "description", "date"]) {
      if (!meta[key]) errors.push(`frontmatter is missing ${key}`);
    }
    if (meta.date && meta.date !== day) {
      errors.push(`frontmatter date ${meta.date} does not match the filename day ${day}`);
    }
    for (const key of ["title", "description"]) {
      if (meta[key]?.includes("\\")) {
        errors.push(
          `frontmatter ${key} has an escape sequence the site renders literally; only \\" is understood, rewrite the rest in plain words`,
        );
      }
      if (meta[key] && /==|\(\(/.test(meta[key])) {
        errors.push(`frontmatter ${key} carries a pen mark; marks belong in the body only`);
      }
    }
  }

  const body = rawBody.trim();
  if (!body) errors.push("digest body is empty");

  const published = publishedLinks(body);
  const links = published.map((l) => l.url);
  if (body && links.length === 0) errors.push("digest has no inline links");
  // Editorial, not layout: #199 put overflow-wrap on .prose a, so a bare url
  // wraps rather than widening the page. What is left is that the reader gets
  // a url where the words should be.
  for (const url of new Set(published.filter((l) => l.bare).map((l) => l.url))) {
    warnings.push(
      `bare url as link text: ${url}; a link carries its own words ([title](url)), never the url itself`,
    );
  }
  for (const entry of linklessEntries(body)) {
    warnings.push(
      `entry carries no link: "${truncate(entry, 70)}"; every entry links inline to its best source url (AGENTS.md)`,
    );
  }
  for (const url of links) {
    if (!/^https?:\/\//.test(url)) errors.push(`non-http link: ${url}`);
  }
  if (links.length > 0 && links.length < 8) {
    warnings.push(`only ${links.length} links; a full day usually carries ~15 entries`);
  }
  if (links.length > 60) {
    warnings.push(`${links.length} links; the digest should be readable in one sitting`);
  }

  let pickUrls: string[] = [];
  try {
    pickUrls = readPicks(rootDir, day)?.items.map((i) => i.url) ?? [];
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }

  // AGENTS.md puts yesterday's picks on today's run as well as its own: a pick
  // recorded after the evening run was never digested, so today covers it like
  // one of today's. A hand-found url sits in no items file by definition, and
  // carriedOver reads data/items/ only, so without this the contract's own
  // prescribed act reads back as "primary source or typo?".
  const prevDay = daysBefore(day, 1);
  let prevPickUrls: string[] = [];
  try {
    prevPickUrls = readPicks(rootDir, prevDay)?.items.map((i) => i.url) ?? [];
  } catch {
    // a malformed yesterday is yesterday's verify run to report, the same way
    // carriedOver passes over an unreadable past items file
  }

  const itemsPath = join(rootDir, "data", "items", `${day}.json`);
  if (!existsSync(itemsPath)) {
    warnings.push(`data/items/${day}.json is missing; cannot cross-check links`);
  } else {
    let items: DayItem[] | null = null;
    try {
      items = JSON.parse(readFileSync(itemsPath, "utf8")).items as DayItem[];
      if (!Array.isArray(items)) throw new Error("no items array");
    } catch {
      items = null;
      errors.push(`data/items/${day}.json is unreadable; force a fresh ingest run and re-verify`);
    }
    if (items) {
      const known = new Set(
        [
          ...items.map((i) => i.url).filter(Boolean),
          ...hnPermalinks(items),
          ...pickUrls,
          ...prevPickUrls,
        ].map((u) => normalize(u!)),
      );
      // One warning per unknown url, not per occurrence: a digest that links
      // the same primary source from three entries is one thing to judge, and
      // the count says how far it reaches.
      const unknown = new Map<string, { url: string; count: number }>();
      for (const url of links) {
        if (!/^https?:\/\//.test(url)) continue;
        const key = normalize(url);
        if (known.has(key)) continue;
        const seen = unknown.get(key);
        if (seen) seen.count += 1;
        else unknown.set(key, { url, count: 1 });
      }
      // Only a day with something unexplained pays for reading the archive.
      const carried = unknown.size > 0 ? carriedOver(rootDir, day) : new Map<string, string>();
      for (const [key, { url, count }] of unknown) {
        const times = count > 1 ? ` (linked ${count}x)` : "";
        const from = carried.get(key);
        warnings.push(
          from
            ? `carried over from ${from}'s items, not today's: ${url}${times}`
            : `link not found in the day's items (primary source or typo?): ${url}${times}`,
        );
      }
    }
  }

  const linked = new Set(links.map(normalize));
  for (const url of pickUrls) {
    if (!linked.has(normalize(url))) warnings.push(`pick not covered: ${url}`);
  }

  // The agent-scripted carousel ships beside the digest; mechanical
  // guideline checks live here, tone and safety stay in the AGENTS.md
  // contract.
  let dayPosts = null;
  try {
    dayPosts = readSlidePosts(rootDir, day);
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }
  if (!dayPosts) {
    if (!existsSync(join(rootDir, "data", "slides", `${day}.json`))) {
      warnings.push(
        `data/slides/${day}.json is missing; the carousel script ships with the digest (see AGENTS.md); expected only for backfilled days and days before the carousel launched`,
      );
    }
  } else {
    let pool: Set<string> | null = null;
    try {
      pool = readHashtagPool(rootDir);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
    const pmExists = dayPosts.posts.some((p) => p.slot === "pm");
    const amUrls = new Set(
      (dayPosts.posts.find((p) => p.slot === "am")?.slides ?? []).map((s) => normalize(s.url)),
    );
    const visible = (s: string): string => s.replace(/==|\(\(|\)\)/g, "");
    for (const post of dayPosts.posts) {
      const at = `${post.slot} post`;
      const { caption, hashtags, hook, slides } = post;
      if (caption.length > 500) {
        errors.push(`${at}: caption is ${caption.length} chars; it is a hook, not the digest (max 500)`);
      }
      if (!caption.includes("sift.yasint.dev") || !caption.includes("link in bio")) {
        errors.push(`${at}: caption must point home: "full digest at sift.yasint.dev (link in bio)"`);
      }
      if (/https?:\/\//.test(caption)) {
        errors.push(`${at}: caption carries a raw url; instagram does not link captions, name sift.yasint.dev bare`);
      }
      if (/(?<![\w.])@[a-z0-9_.]/i.test(caption)) {
        errors.push(`${at}: caption @-mentions an account; never reference real accounts`);
      }
      if (caption.includes("\\")) errors.push(`${at}: caption has a backslash escape; rewrite in plain words`);
      if (hashtags.length < 3 || hashtags.length > 6) {
        errors.push(`${at}: ${hashtags.length} hashtags; pick 3-6 from config/social.json`);
      }
      if (new Set(hashtags).size !== hashtags.length) errors.push(`${at}: duplicate hashtags`);
      for (const tag of hashtags) {
        if (!/^#[a-z0-9]+$/.test(tag)) errors.push(`${at}: hashtag ${tag} is not lowercase #alphanumeric`);
        else if (pool && !pool.has(tag)) {
          errors.push(`${at}: hashtag ${tag} is not in the config/social.json pool; never invent one`);
        }
      }
      if (/==|\(\(/.test(hook) || /==|\(\(/.test(caption)) {
        errors.push(`${at}: hook and caption render as plain text; pen marks belong on slides only`);
      }
      if (hook.length > 120) errors.push(`${at}: hook is ${hook.length} chars; the cover fits 120`);
      if (slides.length < 3 || slides.length > 8) {
        errors.push(`${at}: ${slides.length} slides; a post carries 3-8 stories (cover and cta ride along)`);
      }
      let markCount = 0;
      const seenInPost = new Set<string>();
      for (const slide of slides) {
        const where = `${at}, slide ${slide.number}`;
        const titleLen = visible(slide.title).length;
        const descLen = visible(slide.desc).length;
        if (titleLen > 120) errors.push(`${where}: title is ${titleLen} chars; it renders amputated past 120`);
        if (descLen > 110) errors.push(`${where}: desc is ${descLen} chars; it renders amputated past 110`);
        if (slide.category !== slide.category.toLowerCase()) errors.push(`${where}: category must be lowercase`);
        if (slide.category.length > 28) {
          errors.push(`${where}: category is ${slide.category.length} chars; the header fits 28`);
        }
        const text = `${slide.title} ${slide.desc}`;
        if (/\]\(|\*\*/.test(text)) errors.push(`${where}: markdown syntax; slides are plain text plus pen marks`);
        if (/\(\(|\)\)/.test(text)) {
          errors.push(`${where}: circle marks are digest ink; slides underline with ==text== only`);
        }
        const terms = slide.terms ?? [];
        if (terms.length > 2) errors.push(`${where}: ${terms.length} terms; a slide explains at most 2 abbreviations`);
        for (const term of terms) {
          if (!text.includes(term.abbr)) errors.push(`${where}: term ${term.abbr} does not appear on the slide`);
          if (term.gloss.length > 70) {
            errors.push(`${where}: gloss for ${term.abbr} is ${term.gloss.length} chars; footnotes fit 70`);
          }
          if (/==|\(\(|\]\(|\*\*/.test(term.gloss)) {
            errors.push(`${where}: gloss for ${term.abbr} carries marks or markdown; plain words only`);
          }
        }
        if (text.replace(MARK_U, "").includes("==")) errors.push(`${where}: unclosed pen mark`);
        if (slide.title.trim().toLowerCase() === hook.trim().toLowerCase()) {
          warnings.push(`${at}: hook duplicates slide ${slide.number}'s title; the hook reframes the lead, never copies it`);
        }
        markCount += (text.match(MARK_U) ?? []).length;
        if (/[–—]/.test(text)) warnings.push(`${where}: em/en dash on the card; use a comma or colon`);
        if (/\p{Extended_Pictographic}/u.test(text)) warnings.push(`${where}: emoji on the card; the cards do not use them`);
        const url = normalize(slide.url);
        if (seenInPost.has(url)) errors.push(`${where}: repeats a url already on this post: ${slide.url}`);
        seenInPost.add(url);
        if (!linked.has(url)) {
          if (post.slot === "am" && pmExists) {
            warnings.push(
              `${where}: am slide url no longer linked in the digest; the evening rewrite keeps am stories linked (see AGENTS.md): ${slide.url}`,
            );
          } else {
            errors.push(`${where}: url is not a link in the digest; slides only carry digested stories: ${slide.url}`);
          }
        }
        if (post.slot === "pm" && amUrls.has(url)) {
          errors.push(`${where}: repeats an am story; the pm post covers only what the evening added: ${slide.url}`);
        }
      }
      if (markCount > 3) warnings.push(`${at}: ${markCount} pen marks; marks lose punch past 2-3`);
      for (const domain of caption.match(/\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}\b/gi) ?? []) {
        const named = domain.toLowerCase();
        if (named === "sift.yasint.dev" || named.endsWith(".js")) continue;
        warnings.push(`${at}: caption names a domain other than sift.yasint.dev: ${domain}`);
      }
      if (/[A-Z]/.test(caption)) warnings.push(`${at}: caption has uppercase; yasin writes lowercase`);
      if (/\p{Extended_Pictographic}/u.test(`${caption} ${hook}`)) {
        warnings.push(`${at}: caption or hook has emoji; the voice does not use them`);
      }
      if (/[–—]/.test(`${caption} ${hook}`)) warnings.push(`${at}: em/en dash in caption or hook; use a comma or colon`);
    }
  }

  const earlier = readdirSync(join(rootDir, "digests"))
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f) && f < `${day}.md`)
    .sort();
  const digested = new Map<string, string>();
  for (const file of earlier) {
    const text = readFileSync(join(rootDir, "digests", file), "utf8");
    for (const { url } of publishedLinks(parseFrontmatter(text).body)) {
      digested.set(normalize(url), file.slice(0, 10));
    }
  }
  for (const url of new Set(links.map(normalize))) {
    const usedOn = digested.get(url);
    if (usedOn) warnings.push(`already digested on ${usedOn}: ${url}`);
  }

  // Yesterday's pick is chased on the day the contract assigns it. "pick not
  // covered" fires on the day a pick lands, which is premature by that same
  // contract (the evening run is allowed to miss a pick recorded minutes
  // before it) and then goes quiet on the run that owes it. The digested map
  // above answers "did any earlier digest already link it" for free.
  for (const url of prevPickUrls) {
    const key = normalize(url);
    if (linked.has(key) || digested.has(key)) continue;
    warnings.push(`pick from ${prevDay} still not covered: ${url}`);
  }

  const dashes = (raw.match(/[–—]/g) ?? []).length;
  if (dashes > 0) {
    warnings.push(`${dashes} em/en dashes; rewrite with commas, colons or parentheses`);
  }

  const prose = body.replace(/\]\([^)\s]+\)/g, "]()");
  const marks = (prose.match(MARK_U) ?? []).length + (prose.match(MARK_O) ?? []).length;
  const unmarked = prose.replace(MARK_U, "").replace(MARK_O, "");
  if (unmarked.includes("==")) errors.push("unclosed == pen mark; close it or drop the markers");
  if (unmarked.includes("((")) errors.push("unclosed (( pen mark; close it or drop the markers");
  if (marks > 3) warnings.push(`${marks} pen marks; marks lose punch past 2-3 a day`);

  // A mark has to read as emphasis, and on link text it cannot. `mark.pen`
  // sets --bold, which beats the link's own --accent, so the marked words go
  // pale mid-link and the link reads as broken in two; and the scribble is
  // stroked in --accent, the link's own colour, over a band that swallows the
  // link's dotted underline. Both render as link chrome, which is why
  // AGENTS.md puts link text out of bounds. Either nesting looks the same,
  // <mark> inside <a> or around it, so overlap is the test, not containment.
  const spansOf = (re: RegExp): [number, number][] =>
    [...prose.matchAll(re)].map((m) => [m.index, m.index + m[0].length]);
  const linkText = spansOf(/\[[^\]\n]*\]\(\)/g);
  for (const [start, end] of [...spansOf(MARK_U), ...spansOf(MARK_O)]) {
    if (linkText.some(([from, to]) => start < to && from < end)) {
      warnings.push(
        `pen mark on link text: ${prose.slice(start, end)}; the marked words lose the link's colour and the scribble lands on its underline, so the mark reads as link chrome (AGENTS.md: never on link text)`,
      );
    }
  }

  if (body && !/^##\s+Threads\b/m.test(body)) {
    warnings.push("no Threads section; add one unless nothing genuinely connects today");
  }

  if (body && !/^##\s+Hacker News\b/m.test(body)) {
    warnings.push("no Hacker News section; the digest carries a front-page summary (see AGENTS.md)");
  }

  return { ok: errors.length === 0, errors, warnings };
}

const invokedDirectly = process.argv[1]?.endsWith("verify.ts");
if (invokedDirectly) {
  const result = verifyDigest(resolve("."), process.argv[2] ?? today());
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}
