import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { today } from "../day";
import { readPicks } from "../pipeline/picks";
import { readHashtagPool, readSlidePosts } from "../slides/data";
import { parseFrontmatter } from "./frontmatter";

export interface VerifyResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

const LINK = /\]\(([^)\s]+)\)/g;
const MARK_U = /==[^=\n]+?==/g;
const MARK_O = /\(\([^()\n]+?\)\)/g;

const normalize = (url: string): string => url.replace(/\/+$/, "");

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

  const links = [...body.matchAll(LINK)].map((m) => m[1]!);
  if (body && links.length === 0) errors.push("digest has no inline links");
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

  const itemsPath = join(rootDir, "data", "items", `${day}.json`);
  if (!existsSync(itemsPath)) {
    warnings.push(`data/items/${day}.json is missing; cannot cross-check links`);
  } else {
    let items: { url?: string }[] | null = null;
    try {
      items = JSON.parse(readFileSync(itemsPath, "utf8")).items as { url?: string }[];
      if (!Array.isArray(items)) throw new Error("no items array");
    } catch {
      items = null;
      errors.push(`data/items/${day}.json is unreadable; force a fresh ingest run and re-verify`);
    }
    if (items) {
      const known = new Set(
        [...items.map((i) => i.url).filter(Boolean), ...pickUrls].map((u) => normalize(u!)),
      );
      for (const url of links) {
        if (/^https?:\/\//.test(url) && !known.has(normalize(url))) {
          warnings.push(`link not found in the day's items (primary source or typo?): ${url}`);
        }
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
        const unmarked = text.replace(MARK_U, "").replace(MARK_O, "");
        if (unmarked.includes("==") || unmarked.includes("((")) errors.push(`${where}: unclosed pen mark`);
        markCount += (text.match(MARK_U) ?? []).length + (text.match(MARK_O) ?? []).length;
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
    for (const m of text.matchAll(LINK)) digested.set(normalize(m[1]!), file.slice(0, 10));
  }
  for (const url of new Set(links.map(normalize))) {
    const usedOn = digested.get(url);
    if (usedOn) warnings.push(`already digested on ${usedOn}: ${url}`);
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
