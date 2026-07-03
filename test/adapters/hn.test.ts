import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { createHnAdapter } from "../../src/adapters/hn";
import type { JsonFetcher } from "../../src/adapters/types";

const F = (p: string) => JSON.parse(readFileSync(join(__dirname, "../fixtures/hn", p), "utf8"));

const fetchJson: JsonFetcher = async (url) => {
  if (url.includes("topstories")) return F("topstories.json");
  if (url.includes("/item/")) return F(`item-${url.match(/item\/(\d+)/)![1]}.json`);
  if (url.includes("algolia")) return F("algolia.json");
  throw new Error("unexpected url " + url);
};

const hn = (opts: Parameters<typeof createHnAdapter>[1], fetch = fetchJson) => {
  const a = createHnAdapter("hacker-news", opts, fetch);
  if (a.mode !== "pull") throw new Error("hn adapter must be pull-mode");
  return a;
};

test("maps stories, filters out below-threshold and non-story items", async () => {
  const a = hn({ lists: ["top"], minScore: 100, maxItems: 60, backfillDays: 0 });
  const items = await a.fetch(new Date());
  const ids = items.map((i) => i.externalId).sort();
  expect(ids).toEqual(["48689028", "48692946"]); // 48695149 (score 96) + 90000001 (job) excluded
  expect(items.every((i) => i.sourceSlug === "hacker-news")).toBe(true);
  const top = items.find((i) => i.externalId === "48689028")!;
  expect(top.title).toContain("GPT");
  expect(top.author).toBeTruthy();
  expect(top.publishedAt).toBeInstanceOf(Date);
});

test("does not throw when a list/backfill endpoint returns a non-array payload", async () => {
  const a = hn({ lists: ["top"], minScore: 0, maxItems: 10, backfillDays: 30 }, async () => null);
  const items = await a.fetch(new Date(0));
  expect(items).toEqual([]);
});

test("drops a story whose time yields an Invalid Date", async () => {
  const stub: JsonFetcher = async (url) => {
    if (url.includes("topstories")) return [1];
    if (url.includes("/item/")) return { id: 1, type: "story", title: "x", score: 500, time: NaN };
    throw new Error("unexpected url " + url);
  };
  const a = hn({ lists: ["top"], minScore: 100, maxItems: 10, backfillDays: 0 }, stub);
  const items = await a.fetch(new Date(0));
  expect(items).toEqual([]);
});

test("dedupes ids that appear in both the list and the algolia backfill", async () => {
  const a = hn({ lists: ["top"], minScore: 100, maxItems: 60, backfillDays: 30 });
  const items = await a.fetch(new Date(0)); // far past -> triggers backfill
  const ids = items.map((i) => i.externalId);
  expect(new Set(ids).size).toBe(ids.length); // no dupes despite overlap
  expect(ids).toContain("48692995"); // unique algolia hit pulled in
  expect(ids).toContain("48689028"); // overlap kept once
});
