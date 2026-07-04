import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { createRssAdapter } from "../../src/pipeline/adapters/rss";

const xml = (p: string) => readFileSync(join(__dirname, "../fixtures/rss", p), "utf8");

const parse = (slug: string, fixture: string, since = new Date(0)) => {
  const a = createRssAdapter({ slug, url: "https://x" });
  if (a.mode !== "body") throw new Error("rss adapter must be body-mode");
  return a.parse(xml(fixture), since);
};

test("maps RSS 2.0 entries, strips html, sets a stable externalId", async () => {
  const items = await parse("lobsters", "lobsters.xml");
  expect(items.length).toBeGreaterThan(0);
  expect(items.every((i) => !i.content.includes("<"))).toBe(true);
  expect(items.every((i) => i.externalId.length > 0 && i.title.length > 0)).toBe(true);
  expect(items.every((i) => i.sourceSlug === "lobsters")).toBe(true);
  expect(items.every((i) => i.mediaType === "text")).toBe(true);
});

test("maps Atom entries with a link/id fallback for externalId", async () => {
  const items = await parse("sw", "simonwillison.xml");
  expect(items.length).toBeGreaterThan(0);
  expect(items.every((i) => i.externalId.length > 0)).toBe(true);
});

test("filters entries published before since", async () => {
  const future = await parse("lobsters", "lobsters.xml", new Date("2099-01-01"));
  expect(future).toHaveLength(0);
});

test("drops an entry whose pubDate is unparseable instead of emitting an Invalid Date", async () => {
  const items = await parse("bad", "bad-date.xml");
  expect(items.every((i) => !Number.isNaN(i.publishedAt.getTime()))).toBe(true);
  expect(items.map((i) => i.externalId)).toEqual(["https://example.com/good"]);
});

test("stamps mediaType video when configured", async () => {
  const a = createRssAdapter({ slug: "fireship", url: "https://x", mediaType: "video" });
  if (a.mode !== "body") throw new Error("rss adapter must be body-mode");
  const items = await a.parse(xml("lobsters.xml"), new Date(0));
  expect(items.length).toBeGreaterThan(0);
  expect(items.every((i) => i.mediaType === "video")).toBe(true);
});

test("strips zero-width watermark characters from titles and content", async () => {
  const feed = `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title>
    <item><title>Zero​width‌ title﻿</title><guid>e1</guid>
    <link>https://example.com/1</link><pubDate>${new Date().toUTCString()}</pubDate>
    <description>body​text</description></item>
  </channel></rss>`;
  const a = createRssAdapter({ slug: "stackoverflow-blog", url: "https://x" });
  if (a.mode !== "body") throw new Error("rss adapter must be body-mode");
  const items = await a.parse(feed, new Date(0));
  expect(items[0]!.title).toBe("Zerowidth title");
  expect(items[0]!.content).toBe("bodytext");
});

test("tolerates html-named entities that are not valid xml", async () => {
  const feed = `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title>
    <item><title>Security&nbsp;news: what&rsquo;s new &wibble;</title><guid>e1</guid>
    <link>https://example.com/1</link><pubDate>${new Date().toUTCString()}</pubDate>
    <description>body&hellip;</description></item>
  </channel></rss>`;
  const a = createRssAdapter({ slug: "tldrsec", url: "https://x" });
  if (a.mode !== "body") throw new Error("rss adapter must be body-mode");
  const items = await a.parse(feed, new Date(0));
  expect(items).toHaveLength(1);
  expect(items[0]!.title).toContain("Security news: what’s new");
  expect(items[0]!.content).toContain("body…");
});
