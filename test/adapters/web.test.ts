import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { createWebAdapter } from "../../src/pipeline/adapters/web";

const read = (p: string) => readFileSync(join(__dirname, "../fixtures/web", p), "utf8");
const archives = read("tldr-archives.html");
const issue = read("tldr-issue.html");
const anthropicNews = read("anthropic-news.html");
const anthropicCards = read("anthropic-news-cards.html");
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

// The index carries posts up to 50 days old, so the date has to come off the
// card: a clock stamp clears the 48h window in ingest.ts whatever the post's
// real age, and moves with every run, so the story re-enters a day file each
// time the 7-day seen index forgets it.
const anthropicWeb = (html: string) =>
  web({ slug: "anthropic-news", url: "https://www.anthropic.com/news", extractor: "anthropic-news" }, async () => html);

test("anthropic cards are dated from the card, never from the clock", async () => {
  const now = Date.now();
  for (const html of [anthropicNews, anthropicCards]) {
    const items = await anthropicWeb(html).fetch(new Date(0));
    expect(items.length).toBeGreaterThan(0);
    expect(validRaw(items)).toBe(true);
    expect(items.every((i) => Math.abs(i.publishedAt.getTime() - now) > 86_400_000)).toBe(true);
  }
});

test("anthropic reads the date and deck from the enclosing card", async () => {
  const items = await anthropicWeb(anthropicCards).fetch(new Date(0));
  const byUrl = new Map(items.map((i) => [i.url, i]));
  // A tile: date in the card header, deck in the link beside the heading.
  const tile = byUrl.get("https://www.anthropic.com/news/public-benefit-fund")!;
  expect(tile.publishedAt.toISOString().slice(0, 10)).toBe("2026-10-18");
  expect(tile.content).toContain("Anthropic Public Benefit Fund");
  // A listing row: date in its own cell, two columns away from the title link.
  const row = byUrl.get("https://www.anthropic.com/news/anthropic-prices-initial-public-offering")!;
  expect(row.publishedAt.toISOString().slice(0, 10)).toBe("2026-11-18");
  expect(row.content).toContain("priced its initial public offering");
  // The category chip is a link in a paragraph, never the deck.
  expect(items.some((i) => i.content === "Announcements")).toBe(false);
});

test("an anthropic card with no date is skipped, not stamped with now", async () => {
  const card = (date: string) =>
    `<body><article>${date}<a href="/news/undated"><h3>A post</h3><p>Its deck.</p></a></article></body>`;
  expect(await anthropicWeb(card("<time>Nov 2, 2026</time>")).fetch(new Date(0))).toHaveLength(1);
  expect(await anthropicWeb(card("")).fetch(new Date(0))).toEqual([]);
});

test("anthropic stories in one grid keep their own dates", async () => {
  const card = (slug: string, date: string) =>
    `<article><time>${date}</time><a href="/news/${slug}"><h3>${slug}</h3></a></article>`;
  const grid = `<body><div>${card("first", "Nov 2, 2026")}${card("second", "Nov 7, 2026")}</div></body>`;
  const items = await anthropicWeb(grid).fetch(new Date(0));
  expect(items.map((i) => [i.title, i.publishedAt.toISOString().slice(0, 10)])).toEqual([
    ["first", "2026-11-02"],
    ["second", "2026-11-07"],
  ]);
});

test("the nearest date above an anthropic link wins, however deep", async () => {
  // A section stamp above the cards, and the story's own date three levels up.
  const page = `<body><div><time>Jan 1, 2026</time>` +
    `<article><time>Nov 7, 2026</time><div><div><a href="/news/x"><h3>x</h3></a></div></div></article>` +
    `</div></body>`;
  const items = await anthropicWeb(page).fetch(new Date(0));
  expect(items.map((i) => i.publishedAt.toISOString().slice(0, 10))).toEqual(["2026-11-07"]);
});

test("an anthropic card dated in plain text is read too, but <time> wins", async () => {
  const plain = `<body><article><div>Nov 7, 2026</div><a href="/news/x"><h3>x</h3></a></article></body>`;
  const both = `<body><article>Updated Jan 1, 2026 <time>Nov 7, 2026</time>` +
    `<a href="/news/x"><h3>x</h3></a></article></body>`;
  for (const page of [plain, both]) {
    const items = await anthropicWeb(page).fetch(new Date(0));
    expect(items.map((i) => i.publishedAt.toISOString().slice(0, 10))).toEqual(["2026-11-07"]);
  }
});

test("an undated anthropic card does not borrow its dated neighbour's date", async () => {
  const grid = `<body><div>` +
    `<article><a href="/news/undated"><h3>undated</h3></a></article>` +
    `<article><a href="/news/dated"><h3>dated</h3></a><time>Nov 7, 2026</time></article>` +
    `</div></body>`;
  const items = await anthropicWeb(grid).fetch(new Date(0));
  expect(items.map((i) => i.title)).toEqual(["dated"]);
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
