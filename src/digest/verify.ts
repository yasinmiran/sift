import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { today } from "../day";
import { readPicks } from "../pipeline/picks";
import { readHashtagPool, readSocial } from "../pipeline/social";
import { parseFrontmatter } from "./frontmatter";

export interface VerifyResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

const LINK = /\]\(([^)\s]+)\)/g;

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
          `frontmatter ${key} has an escape sequence the site renders literally; only \\" and \\\\ are understood, rewrite the rest in plain words`,
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
    const items = JSON.parse(readFileSync(itemsPath, "utf8")).items as { url?: string }[];
    const known = new Set(
      [...items.map((i) => i.url).filter(Boolean), ...pickUrls].map((u) => normalize(u!)),
    );
    for (const url of links) {
      if (/^https?:\/\//.test(url) && !known.has(normalize(url))) {
        warnings.push(`link not found in the day's items (primary source or typo?): ${url}`);
      }
    }
  }

  const linked = new Set(links.map(normalize));
  for (const url of pickUrls) {
    if (!linked.has(normalize(url))) warnings.push(`pick not covered: ${url}`);
  }

  // The instagram caption ships beside the digest; mechanical guideline
  // checks live here, tone and safety stay in the AGENTS.md contract.
  let social = null;
  try {
    social = readSocial(rootDir, day);
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }
  if (!social) {
    if (!existsSync(join(rootDir, "data", "social", `${day}.json`))) {
      warnings.push(`data/social/${day}.json is missing; the instagram caption ships with the digest (see AGENTS.md)`);
    }
  } else {
    const { caption, hashtags } = social;
    if (caption.length > 500) {
      errors.push(`caption is ${caption.length} chars; it is a hook, not the digest (max 500)`);
    }
    if (!caption.includes("sift.yasint.dev") || !caption.includes("link in bio")) {
      errors.push('caption must point home: "full digest at sift.yasint.dev (link in bio)"');
    }
    if (/https?:\/\//.test(caption)) {
      errors.push("caption carries a raw url; instagram does not link captions, name sift.yasint.dev bare");
    }
    if (/@[a-z0-9_.]/i.test(caption)) errors.push("caption @-mentions an account; never reference real accounts");
    if (caption.includes("\\")) errors.push("caption has a backslash escape; rewrite in plain words");
    if (hashtags.length < 3 || hashtags.length > 6) {
      errors.push(`${hashtags.length} hashtags; pick 3-6 from config/social.json`);
    }
    if (new Set(hashtags).size !== hashtags.length) errors.push("duplicate hashtags");
    const pool = readHashtagPool(rootDir);
    for (const tag of hashtags) {
      if (!/^#[a-z0-9]+$/.test(tag)) errors.push(`hashtag ${tag} is not lowercase #alphanumeric`);
      else if (!pool.has(tag)) errors.push(`hashtag ${tag} is not in the config/social.json pool; never invent one`);
    }
    for (const domain of caption.match(/\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}\b/g) ?? []) {
      if (domain !== "sift.yasint.dev") warnings.push(`caption names a domain other than sift.yasint.dev: ${domain}`);
    }
    if (/[A-Z]/.test(caption)) warnings.push("caption has uppercase; yasin writes lowercase");
    if (/\p{Extended_Pictographic}/u.test(caption)) warnings.push("caption has emoji; the voice does not use them");
    if (/[–—]/.test(caption)) warnings.push("caption has an em/en dash; use a comma or colon");
  }

  const earlier = readdirSync(join(rootDir, "digests"))
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f) && f < `${day}.md`)
    .sort();
  const digested = new Map<string, string>();
  for (const file of earlier) {
    const text = readFileSync(join(rootDir, "digests", file), "utf8");
    for (const m of text.matchAll(LINK)) digested.set(normalize(m[1]!), file.slice(0, 10));
  }
  for (const url of links) {
    const usedOn = digested.get(normalize(url));
    if (usedOn) warnings.push(`already digested on ${usedOn}: ${url}`);
  }

  const dashes = (raw.match(/[–—]/g) ?? []).length;
  if (dashes > 0) {
    warnings.push(`${dashes} em/en dashes; rewrite with commas, colons or parentheses`);
  }

  const MARK_U = /==[^=\n]+?==/g;
  const MARK_O = /\(\([^()\n]+?\)\)/g;
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
