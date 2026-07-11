import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// The digest agent's carousel script for a day (data/slides/{day}.json):
// the morning run writes the am post, the evening run appends pm and never
// edits am. The renderer and verify both read it.
export interface SlideSpec {
  number: number;
  category: string;
  title: string;
  desc: string;
  url: string;
}

export interface SlidePost {
  slot: "am" | "pm";
  hook: string;
  caption: string;
  hashtags: string[];
  slides: SlideSpec[];
}

export interface DayPosts {
  day: string;
  posts: SlidePost[];
}

/** Read and shape-validate a day's carousel script; null when the day has none. */
export function readSlidePosts(rootDir: string, day: string): DayPosts | null {
  const path = join(rootDir, "data", "slides", `${day}.json`);
  if (!existsSync(path)) return null;
  const file = `data/slides/${day}.json`;
  const parsed = JSON.parse(readFileSync(path, "utf8")) as DayPosts;
  if (parsed.day !== day) throw new Error(`${file}: day ${parsed.day} does not match the filename`);
  if (!Array.isArray(parsed.posts) || parsed.posts.length < 1 || parsed.posts.length > 2) {
    throw new Error(`${file}: posts must hold the am post and optionally the pm post`);
  }
  const slots = parsed.posts.map((p) => p?.slot);
  if (slots.some((s) => s !== "am" && s !== "pm") || new Set(slots).size !== slots.length) {
    throw new Error(`${file}: post slots must be unique and one of am, pm`);
  }
  for (const post of parsed.posts) {
    const at = `${file} (${post.slot})`;
    for (const key of ["hook", "caption"] as const) {
      if (typeof post[key] !== "string" || !post[key].trim()) {
        throw new Error(`${at}: ${key} must be a non-empty string`);
      }
    }
    if (!Array.isArray(post.hashtags) || post.hashtags.some((h) => typeof h !== "string")) {
      throw new Error(`${at}: hashtags must be an array of strings`);
    }
    if (!Array.isArray(post.slides) || post.slides.length === 0) {
      throw new Error(`${at}: slides must be a non-empty array`);
    }
    post.slides.forEach((slide, i) => {
      for (const key of ["category", "title", "desc"] as const) {
        if (typeof slide?.[key] !== "string" || !slide[key].trim()) {
          throw new Error(`${at}: slide ${i + 1} needs ${key}`);
        }
      }
      if (typeof slide.url !== "string" || !/^https?:\/\//.test(slide.url)) {
        throw new Error(`${at}: slide ${i + 1} needs an http(s) url`);
      }
      if (slide.number !== i + 1) throw new Error(`${at}: slide numbers must run 1..n in order`);
    });
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
