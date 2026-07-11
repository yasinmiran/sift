import { beforeEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readHashtagPool, readSlidePosts } from "../src/slides/data";

const DAY = "2026-07-11";

const post = (over: Record<string, unknown> = {}) => ({
  slot: "am",
  hook: "apple sues openai",
  caption: "apple sues openai. full digest at sift.yasint.dev (link in bio)",
  hashtags: ["#tech", "#ai", "#infosec"],
  slides: [
    { number: 1, category: "ai / llms", title: "GPT-6 lands", desc: "a 5x cut", url: "https://e.com/a" },
  ],
  ...over,
});

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "sift-slides-data-"));
  mkdirSync(join(root, "data", "slides"), { recursive: true });
  mkdirSync(join(root, "config"), { recursive: true });
});

const write = (content: unknown) =>
  writeFileSync(join(root, "data", "slides", `${DAY}.json`), JSON.stringify(content));

describe("readSlidePosts", () => {
  it("reads a valid day and returns null when the day has none", () => {
    expect(readSlidePosts(root, DAY)).toBeNull();
    write({ day: DAY, posts: [post()] });
    expect(readSlidePosts(root, DAY)?.posts[0]?.slot).toBe("am");
  });

  it("accepts am plus pm but rejects duplicate or unknown slots", () => {
    write({ day: DAY, posts: [post(), post({ slot: "pm" })] });
    expect(readSlidePosts(root, DAY)?.posts).toHaveLength(2);
    write({ day: DAY, posts: [post(), post()] });
    expect(() => readSlidePosts(root, DAY)).toThrow(/slots/);
    write({ day: DAY, posts: [post({ slot: "noon" })] });
    expect(() => readSlidePosts(root, DAY)).toThrow(/slots/);
    write({ day: DAY, posts: [] });
    expect(() => readSlidePosts(root, DAY)).toThrow(/posts/);
  });

  it("throws on a day mismatch", () => {
    write({ day: "2026-07-10", posts: [post()] });
    expect(() => readSlidePosts(root, DAY)).toThrow(/does not match the filename/);
  });

  it("throws on missing singletons or malformed hashtags", () => {
    write({ day: DAY, posts: [post({ hook: "  " })] });
    expect(() => readSlidePosts(root, DAY)).toThrow(/hook/);
    write({ day: DAY, posts: [post({ caption: undefined })] });
    expect(() => readSlidePosts(root, DAY)).toThrow(/caption/);
    write({ day: DAY, posts: [post({ hashtags: "#ai" })] });
    expect(() => readSlidePosts(root, DAY)).toThrow(/hashtags/);
  });

  it("accepts optional terms and rejects malformed ones", () => {
    write({
      day: DAY,
      posts: [
        post({
          slides: [
            {
              number: 1,
              category: "security & privacy",
              title: "A CISA leak",
              desc: "d",
              url: "https://e.com/a",
              terms: [{ abbr: "CISA", gloss: "the US government's civilian cyber-defense agency" }],
            },
          ],
        }),
      ],
    });
    expect(readSlidePosts(root, DAY)?.posts[0]?.slides[0]?.terms?.[0]?.abbr).toBe("CISA");
    write({
      day: DAY,
      posts: [
        post({
          slides: [
            { number: 1, category: "x", title: "t", desc: "d", url: "https://e.com/a", terms: [{ abbr: "X" }] },
          ],
        }),
      ],
    });
    expect(() => readSlidePosts(root, DAY)).toThrow(/gloss/);
    write({
      day: DAY,
      posts: [
        post({
          slides: [{ number: 1, category: "x", title: "t", desc: "d", url: "https://e.com/a", terms: "CISA" }],
        }),
      ],
    });
    expect(() => readSlidePosts(root, DAY)).toThrow(/terms/);
  });

  it("throws on incomplete slides, bad urls and broken numbering", () => {
    write({ day: DAY, posts: [post({ slides: [] })] });
    expect(() => readSlidePosts(root, DAY)).toThrow(/slides/);
    write({
      day: DAY,
      posts: [post({ slides: [{ number: 1, category: "x", title: "t", desc: "", url: "https://e.com" }] })],
    });
    expect(() => readSlidePosts(root, DAY)).toThrow(/desc/);
    write({
      day: DAY,
      posts: [post({ slides: [{ number: 1, category: "x", title: "t", desc: "d", url: "ftp://e.com" }] })],
    });
    expect(() => readSlidePosts(root, DAY)).toThrow(/http/);
    write({
      day: DAY,
      posts: [post({ slides: [{ number: 2, category: "x", title: "t", desc: "d", url: "https://e.com" }] })],
    });
    expect(() => readSlidePosts(root, DAY)).toThrow(/numbers/);
  });
});

describe("readHashtagPool", () => {
  it("reads the curated pool from config", () => {
    writeFileSync(join(root, "config", "social.json"), JSON.stringify({ hashtags: ["#tech", "#ai"] }));
    expect(readHashtagPool(root)).toEqual(new Set(["#tech", "#ai"]));
  });
});
