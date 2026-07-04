import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadSources } from "../src/pipeline/sources";

describe("source registry", () => {
  it("loads the checked-in registry, lane-free", () => {
    const sources = loadSources();
    expect(sources.length).toBeGreaterThanOrEqual(40);
    for (const s of sources) {
      expect(["hn", "rss", "web", "arxiv"]).toContain(s.kind);
      expect(s).not.toHaveProperty("lane");
    }
  });

  it("rejects a malformed entry", () => {
    const dir = mkdtempSync(join(tmpdir(), "sift-src-"));
    const bad = join(dir, "sources.json");
    writeFileSync(bad, JSON.stringify([{ slug: "x", kind: "carrier-pigeon", topics: ["general"], enabled: true }]));
    expect(() => loadSources(bad)).toThrow(/invalid source entry/);
  });

  it("rejects unknown topics and empty topic lists", () => {
    const dir = mkdtempSync(join(tmpdir(), "sift-src-"));
    for (const topics of [[], ["ai-lms"]]) {
      const bad = join(dir, "sources.json");
      writeFileSync(bad, JSON.stringify([{ slug: "x", kind: "rss", url: "https://x", topics, enabled: true }]));
      expect(() => loadSources(bad)).toThrow(/invalid source entry/);
    }
  });
});
