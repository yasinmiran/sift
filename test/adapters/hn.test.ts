import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { createHnAdapter } from "../../src/pipeline/adapters/hn";
import type { JsonFetcher } from "../../src/pipeline/adapters/types";

const F = (p: string) => JSON.parse(readFileSync(join(__dirname, "../fixtures/hn", p), "utf8"));

const now = Math.floor(Date.now() / 1000);

// The current front page: one solid story, one below threshold, one job-ish
// score-less entry. Shapes mirror hn.algolia.com/api/v1/search?tags=front_page.
const frontPage = {
  hits: [
    {
      objectID: "48689028",
      title: "GPT-6 leaks",
      url: "https://example.com/gpt6",
      author: "pg",
      points: 328,
      num_comments: 214,
      created_at_i: now - 3600,
    },
    {
      objectID: "48695149",
      title: "Show HN: tiny thing",
      url: "https://example.com/tiny",
      author: "someone",
      points: 42,
      created_at_i: now - 7200,
    },
    { objectID: "90000001", title: "Acme is hiring", created_at_i: now - 1800 },
  ],
};

const fetchJson: JsonFetcher = async (url) => {
  if (url.includes("tags=front_page")) return frontPage;
  if (url.includes("search_by_date")) return F("algolia.json");
  throw new Error("unexpected url " + url);
};

const hn = (opts: Parameters<typeof createHnAdapter>[1], fetch = fetchJson) => {
  const a = createHnAdapter("hacker-news", opts, fetch);
  if (a.mode !== "pull") throw new Error("hn adapter must be pull-mode");
  return a;
};

test("reads the front page and filters out below-threshold and score-less entries", async () => {
  const a = hn({ minScore: 100, maxItems: 60, backfillDays: 0 });
  const items = await a.fetch(new Date());
  expect(items.map((i) => i.externalId)).toEqual(["48689028"]);
  expect(items[0]!.points).toBe(328);
  expect(items[0]!.comments).toBe(214);
  const top = items[0]!;
  expect(top.sourceSlug).toBe("hacker-news");
  expect(top.title).toContain("GPT");
  expect(top.author).toBe("pg");
  expect(top.url).toBe("https://example.com/gpt6"); // a story keeps the article it points at
  expect(top.publishedAt).toBeInstanceOf(Date);
});

// Algolia sends no url for a story whose body is the post, which is 21 of the
// 992 hn items in the archive this was written against. The shape below is a
// real one, objectID and all: news.ycombinator.com/item?id=49462253.
test("links a self-post to its discussion, the only url it has", async () => {
  const stub: JsonFetcher = async (url) => {
    if (url.includes("tags=front_page"))
      return {
        hits: [
          {
            objectID: "49462253",
            title: "Tell HN: PayPal Blocks GrapheneOS",
            author: "grapheneos",
            points: 235,
            num_comments: 145,
            created_at_i: now - 3600,
            story_text: "PayPal has blocked our account with no explanation.",
          },
        ],
      };
    throw new Error("unexpected url " + url);
  };
  const a = hn({ minScore: 100, maxItems: 10, backfillDays: 0 }, stub);
  const items = await a.fetch(new Date());
  expect(items.map((i) => i.url)).toEqual(["https://news.ycombinator.com/item?id=49462253"]);
  expect(items[0]!.content).toContain("PayPal");
});

test("does not throw when an endpoint returns a non-array payload", async () => {
  const a = hn({ minScore: 0, maxItems: 10, backfillDays: 30 }, async () => null);
  const items = await a.fetch(new Date(0));
  expect(items).toEqual([]);
});

test("drops a hit whose created_at_i yields an Invalid Date", async () => {
  const stub: JsonFetcher = async (url) => {
    if (url.includes("tags=front_page"))
      return { hits: [{ objectID: "1", title: "x", points: 500, created_at_i: NaN }] };
    throw new Error("unexpected url " + url);
  };
  const a = hn({ minScore: 100, maxItems: 10, backfillDays: 0 }, stub);
  const items = await a.fetch(new Date(0));
  expect(items).toEqual([]);
});

test("dedupes ids that appear on both the front page and the backfill", async () => {
  const a = hn({ minScore: 100, maxItems: 60, backfillDays: 30 });
  const items = await a.fetch(new Date(0)); // far past -> triggers backfill
  const ids = items.map((i) => i.externalId);
  expect(new Set(ids).size).toBe(ids.length); // 48689028 overlaps, kept once
  expect(ids).toContain("48692995"); // unique backfill hit pulled in
  expect(ids).toContain("48689028");
});
