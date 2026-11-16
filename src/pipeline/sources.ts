import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export interface SourceConfig {
  slug: string;
  kind: "hn" | "rss" | "web" | "arxiv";
  url?: string;
  topics: string[];
  enabled: boolean;
  mediaType?: "video";
}

const KINDS = new Set(["hn", "rss", "web", "arxiv"]);
// Must stay in step with the digest sections in AGENTS.md.
const TOPICS = new Set([
  "ai-llms",
  "devtools-infra",
  "security-privacy",
  "startups-industry",
  "research",
  "frontend",
  "general",
]);
const defaultPath = fileURLToPath(new URL("../../config/sources.json", import.meta.url));

export function loadSources(path: string = defaultPath): SourceConfig[] {
  const sources = JSON.parse(readFileSync(path, "utf8")) as SourceConfig[];
  const slugs = new Set<string>();
  for (const s of sources) {
    const topicsValid =
      Array.isArray(s.topics) && s.topics.length > 0 && s.topics.every((t) => TOPICS.has(t));
    if (!s.slug || !KINDS.has(s.kind) || !topicsValid || typeof s.enabled !== "boolean") {
      throw new Error(`invalid source entry: ${JSON.stringify(s)}`);
    }
    // The slug is this file's primary key, not a label. state.json keys each
    // feed's conditional-GET validators by it, the seen index keys item
    // identity by it (state.ts's `itemKey`), and every stored item carries it
    // as its attribution, which verify.ts then branches on by value. Two
    // entries under one slug therefore share one etag/feedHash pair and
    // clobber it in turn, so neither feed is ever 304-skipped again (live runs
    // skip 20-35 of 54), and a guid either feed has already offered is turned
    // away as a duplicate of the other's: run one of a two-entry registry
    // sharing a guid read `created: 1, duplicate: 1, failures: []` with the
    // second publisher's story nowhere on disk. A duplicate count of 1 is
    // unremarkable next to the 85-214 a live run reports, so nothing says it.
    //
    // Fatal, like an unknown kind: the registry is hand-edited one copied
    // entry at a time, and `npm test` loads the checked-in file, so this
    // fires in `checks` on the pull request and in `ingest` before
    // `npm run ingest` rather than at 03:15 UTC with the data already written.
    if (slugs.has(s.slug)) throw new Error(`duplicate source slug: ${s.slug}`);
    slugs.add(s.slug);
  }
  return sources;
}
