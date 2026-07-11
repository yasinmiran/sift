import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// The day's instagram caption, written by the digest routine beside the
// digest (data/social/{day}.json), gated by verify and published in the
// slides meta.json for posting.
export interface Social {
  day: string;
  caption: string;
  hashtags: string[];
}

/** Read and shape-validate a day's social file; null when the day has none. */
export function readSocial(rootDir: string, day: string): Social | null {
  const path = join(rootDir, "data", "social", `${day}.json`);
  if (!existsSync(path)) return null;
  const file = `data/social/${day}.json`;
  const parsed = JSON.parse(readFileSync(path, "utf8")) as Social;
  if (parsed.day !== day) throw new Error(`${file}: day ${parsed.day} does not match the filename`);
  if (typeof parsed.caption !== "string" || !parsed.caption.trim()) {
    throw new Error(`${file}: caption must be a non-empty string`);
  }
  if (!Array.isArray(parsed.hashtags) || parsed.hashtags.some((h) => typeof h !== "string")) {
    throw new Error(`${file}: hashtags must be an array of strings`);
  }
  return parsed;
}

/** The curated hashtag pool a caption may draw from (config/social.json). */
export function readHashtagPool(rootDir: string): Set<string> {
  const parsed = JSON.parse(readFileSync(join(rootDir, "config", "social.json"), "utf8")) as {
    hashtags: string[];
  };
  return new Set(parsed.hashtags);
}
