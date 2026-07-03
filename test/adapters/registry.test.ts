import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { adapterFor, type Fetchers } from "../../src/adapters/registry";
import type { SourceConfig } from "../../src/sources";
import type { JsonFetcher } from "../../src/adapters/types";

const rssXml = (p: string) => readFileSync(join(__dirname, "../fixtures/rss", p), "utf8");
const webHtml = (p: string) => readFileSync(join(__dirname, "../fixtures/web", p), "utf8");
const hnF = (p: string) => JSON.parse(readFileSync(join(__dirname, "../fixtures/hn", p), "utf8"));

const src = (o: { slug: string; kind: SourceConfig["kind"]; url?: string }): SourceConfig => ({
  topics: [],
  enabled: true,
  ...o,
});

test("rss kind yields a body-mode adapter that parses xml", async () => {
  const a = adapterFor(src({ slug: "lobsters", kind: "rss", url: "https://x/feed" }));
  expect(a.slug).toBe("lobsters");
  if (a.mode !== "body") throw new Error("expected body mode");
  const items = await a.parse(rssXml("lobsters.xml"), new Date(0));
  expect(items.length).toBeGreaterThan(0);
});

test("web kind resolves the extractor named by the source slug (tldr)", async () => {
  const archives = webHtml("tldr-archives.html");
  const issue = webHtml("tldr-issue.html");
  const fetchers: Fetchers = {
    fetchHtml: async (url) => (url.includes("2026-06-26") ? issue : archives),
  };
  const a = adapterFor(src({ slug: "tldr", kind: "web", url: "https://tldr.tech/tech" }), fetchers);
  expect(a.slug).toBe("tldr");
  if (a.mode !== "pull") throw new Error("expected pull mode");
  const items = await a.fetch(new Date(0));
  expect(items.length).toBeGreaterThan(0);
});

test("hn kind builds the hn adapter with sane defaults", async () => {
  const fetchJson: JsonFetcher = async (url) => {
    if (url.includes("topstories")) return hnF("topstories.json");
    if (url.includes("stories")) return [];
    if (url.includes("/item/")) return hnF(`item-${url.match(/item\/(\d+)/)![1]}.json`);
    if (url.includes("algolia")) return hnF("algolia.json");
    throw new Error("unexpected url " + url);
  };
  const a = adapterFor(src({ slug: "hacker-news", kind: "hn" }), { fetchJson });
  expect(a.slug).toBe("hacker-news");
  if (a.mode !== "pull") throw new Error("expected pull mode");
  const items = await a.fetch(new Date());
  expect(items.length).toBeGreaterThan(0);
});

test("unknown web extractor slug throws", () => {
  expect(() => adapterFor(src({ slug: "mystery", kind: "web", url: "https://x" }), {})).toThrow();
});

test("rss without a url throws", () => {
  expect(() => adapterFor(src({ slug: "nourl", kind: "rss" }), {})).toThrow(/url/i);
});
