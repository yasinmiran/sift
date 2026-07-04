import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { today } from "./day";
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

  const itemsPath = join(rootDir, "data", "items", `${day}.json`);
  if (!existsSync(itemsPath)) {
    warnings.push(`data/items/${day}.json is missing; cannot cross-check links`);
  } else {
    const items = JSON.parse(readFileSync(itemsPath, "utf8")).items as { url?: string }[];
    const known = new Set(items.map((i) => i.url).filter(Boolean).map((u) => normalize(u!)));
    for (const url of links) {
      if (/^https?:\/\//.test(url) && !known.has(normalize(url))) {
        warnings.push(`link not found in the day's items (primary source or typo?): ${url}`);
      }
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
  for (const url of links) {
    const usedOn = digested.get(normalize(url));
    if (usedOn) warnings.push(`already digested on ${usedOn}: ${url}`);
  }

  const dashes = (raw.match(/[–—]/g) ?? []).length;
  if (dashes > 0) {
    warnings.push(`${dashes} em/en dashes; rewrite with commas, colons or parentheses`);
  }

  if (body && !/^##\s+Threads\b/m.test(body)) {
    warnings.push("no Threads section; add one unless nothing genuinely connects today");
  }

  return { ok: errors.length === 0, errors, warnings };
}

const invokedDirectly = process.argv[1]?.endsWith("verify.ts");
if (invokedDirectly) {
  const result = verifyDigest(resolve("."), process.argv[2] ?? today());
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}
