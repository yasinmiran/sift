import { beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadDay, saveDay, type StoredItem } from "../src/pipeline/day-file";

const item = (over: Partial<StoredItem> = {}): StoredItem => ({
  sourceSlug: "s",
  externalId: "e1",
  title: "t",
  url: null,
  author: null,
  publishedAt: "2026-07-04T10:00:00.000Z",
  content: "c",
  topics: ["ai-llms"],
  paywalled: false,
  mediaType: "text",
  ...over,
});

let dataDir: string;
beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), "sift-day-file-"));
});

describe("day file", () => {
  it("defaults to an empty day file and round-trips items sorted by publishedAt", () => {
    expect(loadDay(dataDir, "2026-07-04").items).toEqual([]);
    saveDay(dataDir, {
      day: "2026-07-04",
      generatedAt: "2026-07-04T04:00:00.000Z",
      items: [
        item({ externalId: "late", publishedAt: "2026-07-04T12:00:00.000Z" }),
        item({ externalId: "early", publishedAt: "2026-07-04T08:00:00.000Z" }),
      ],
    });
    const loaded = loadDay(dataDir, "2026-07-04");
    expect(loaded.items.map((i) => i.externalId)).toEqual(["early", "late"]);
    const raw = readFileSync(join(dataDir, "items", "2026-07-04.json"), "utf8");
    expect(raw.endsWith("\n")).toBe(true);
  });
});
