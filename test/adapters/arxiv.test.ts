import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { createArxivAdapter } from "../../src/adapters/arxiv";

const xml = (p: string) => readFileSync(join(__dirname, "../fixtures/arxiv", p), "utf8");

const parse = (opts: { maxItems?: number } = {}, since = new Date(0)) => {
  const a = createArxivAdapter({ slug: "arxiv-ai", url: "https://x", ...opts });
  if (a.mode !== "body") throw new Error("arxiv adapter must be body-mode");
  return a.parse(xml("cs-combined.xml"), since);
};

test("keeps only new announcements, skipping replacements and cross listings", async () => {
  const items = await parse();
  expect(items.map((i) => i.externalId)).toEqual([
    "oai:arXiv.org:2507.01001v1",
    "oai:arXiv.org:2507.01003v1",
    "oai:arXiv.org:2507.01004v1",
  ]);
});

test("maps abstract, authors and the abs link", async () => {
  const [first] = await parse();
  expect(first!.title).toBe("Bounded-Memory Agents: A Testbed for Long-Horizon Evaluation");
  expect(first!.url).toBe("https://arxiv.org/abs/2507.01001");
  expect(first!.author).toBe("Ada Example, Grace Sample");
  expect(first!.content).toMatch(/^We introduce a bounded-memory testbed/);
  expect(first!.content).not.toContain("Announce Type");
});

test("caps the volume at maxItems in feed order", async () => {
  const items = await parse({ maxItems: 2 });
  expect(items.map((i) => i.externalId)).toEqual([
    "oai:arXiv.org:2507.01001v1",
    "oai:arXiv.org:2507.01003v1",
  ]);
});

test("filters items published before since", async () => {
  const items = await parse({}, new Date("2099-01-01"));
  expect(items).toHaveLength(0);
});

test("returns nothing on the weekend skeleton feed instead of failing", async () => {
  const a = createArxivAdapter({ slug: "arxiv-ai", url: "https://x" });
  if (a.mode !== "body") throw new Error("arxiv adapter must be body-mode");
  const weekend = `<?xml version='1.0' encoding='UTF-8'?>
<rss xmlns:arxiv="http://arxiv.org/schemas/atom" xmlns:dc="http://purl.org/dc/elements/1.1/" version="2.0">
  <channel><title>cs.AI updates on arXiv.org</title><link>http://rss.arxiv.org/rss/cs.AI</link>
  <description>empty</description><skipDays><day>Saturday</day><day>Sunday</day></skipDays></channel></rss>`;
  expect(await a.parse(weekend, new Date(0))).toEqual([]);
});
