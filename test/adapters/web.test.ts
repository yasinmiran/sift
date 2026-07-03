import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { createWebAdapter } from "../../src/adapters/web";

const read = (p: string) => readFileSync(join(__dirname, "../fixtures/web", p), "utf8");
const archives = read("tldr-archives.html");
const issue = read("tldr-issue.html");
const anthropicNews = read("anthropic-news.html");
const alphasignalLatest = read("alphasignal-latest.html");
const hfPapers = read("hf-daily-papers.html");

const validRaw = (items: { title: string; url?: string; publishedAt: Date }[]) =>
  items.every(
    (i) =>
      i.title.length > 0 &&
      /^https?:\/\//.test(i.url ?? "") &&
      i.publishedAt instanceof Date &&
      !Number.isNaN(i.publishedAt.getTime()),
  );

const web = (opts: Parameters<typeof createWebAdapter>[0], fetchHtml: (url: string) => Promise<string>) => {
  const a = createWebAdapter(opts, fetchHtml);
  if (a.mode !== "pull") throw new Error("web adapter must be pull-mode");
  return a;
};

const tldrFetch = async (url: string) => {
  if (url.includes("archives")) return archives;
  if (url.includes("2026-06-26")) return issue;
  throw new Error("unexpected url " + url);
};

test("tldr web adapter resolves the latest issue and extracts stories", async () => {
  const a = web({ slug: "tldr", url: "https://tldr.tech/tech/archives", extractor: "tldr" }, tldrFetch);
  const items = await a.fetch(new Date(0));
  expect(items.length).toBeGreaterThan(5);
  expect(items.every((i) => i.title.length > 0 && i.content.length > 0)).toBe(true);
  expect(items.every((i) => i.sourceSlug === "tldr")).toBe(true);
  expect(items.every((i) => /^https?:\/\//.test(i.externalId))).toBe(true);
  expect(new Set(items.map((i) => i.externalId)).size).toBe(items.length); // deduped
});

test("anthropic web adapter extracts dated news cards", async () => {
  const a = web(
    { slug: "anthropic-news", url: "https://www.anthropic.com/news", extractor: "anthropic-news" },
    async () => anthropicNews,
  );
  const items = await a.fetch(new Date(0));
  expect(items.length).toBeGreaterThan(0);
  expect(validRaw(items)).toBe(true);
  expect(items.every((i) => i.sourceSlug === "anthropic-news")).toBe(true);
  expect(items.every((i) => i.url!.includes("anthropic.com/news/"))).toBe(true);
  expect(new Set(items.map((i) => i.externalId)).size).toBe(items.length); // deduped
});

test("alphasignal web adapter extracts story headlines", async () => {
  const a = web(
    { slug: "alphasignal", url: "https://alphasignal.ai", extractor: "alphasignal" },
    async () => alphasignalLatest,
  );
  const items = await a.fetch(new Date(0));
  expect(items.length).toBeGreaterThan(0);
  expect(validRaw(items)).toBe(true);
  expect(items.every((i) => i.sourceSlug === "alphasignal")).toBe(true);
  expect(items.every((i) => i.url!.includes("alphasignal.ai/news/"))).toBe(true);
  expect(new Set(items.map((i) => i.externalId)).size).toBe(items.length); // deduped
});

test("hf daily-papers adapter extracts the day's paper cards", async () => {
  const a = web(
    { slug: "hf-daily-papers", url: "https://huggingface.co/papers", extractor: "hf-daily-papers" },
    async () => hfPapers,
  );
  const items = await a.fetch(new Date(0));
  expect(items.length).toBeGreaterThan(5);
  expect(validRaw(items)).toBe(true);
  expect(items.every((i) => i.url!.includes("huggingface.co/papers/"))).toBe(true);
  expect(items.every((i) => !i.url!.includes("#"))).toBe(true);
  expect(new Set(items.map((i) => i.externalId)).size).toBe(items.length); // deduped
});

test("unknown extractor throws at construction", () => {
  expect(() => createWebAdapter({ slug: "x", url: "y", extractor: "nope" }, async () => "")).toThrow();
});
