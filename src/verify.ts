import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { today } from "./day";

export interface VerifyResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

const FRONT = /^---\n([\s\S]*?)\n---\n?/;
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

  const front = FRONT.exec(raw);
  if (!front) {
    errors.push("missing frontmatter block");
  } else {
    const meta: Record<string, string> = {};
    for (const line of front[1]!.split("\n")) {
      const kv = /^(\w+):\s*"?(.*?)"?\s*$/.exec(line);
      if (kv) meta[kv[1]!] = kv[2]!;
    }
    for (const key of ["title", "description", "date"]) {
      if (!meta[key]) errors.push(`frontmatter is missing ${key}`);
    }
    if (meta.date && meta.date !== day) {
      errors.push(`frontmatter date ${meta.date} does not match the filename day ${day}`);
    }
  }

  const body = raw.slice(front?.[0].length ?? 0).trim();
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
