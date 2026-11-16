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

  // Both entries are valid on their own, which is the shape the mistake
  // actually takes: an entry copied to add a feed, url changed, slug not.
  // Asserted on the message so the failure names the key, not the whole entry.
  it("rejects two otherwise-valid entries sharing a slug", () => {
    const dir = mkdtempSync(join(tmpdir(), "sift-src-"));
    const bad = join(dir, "sources.json");
    writeFileSync(
      bad,
      JSON.stringify([
        { slug: "newsroom", kind: "rss", url: "https://alpha.example/feed", topics: ["general"], enabled: true },
        { slug: "newsroom", kind: "rss", url: "https://beta.example/feed", topics: ["general"], enabled: true },
      ]),
    );
    expect(() => loadSources(bad)).toThrow(/duplicate source slug: newsroom/);
  });

  // The whole file, not the enabled subset: state.json's validators and the
  // seen index are keyed by slug whatever `enabled` says, and pruneSources
  // deliberately reads the full registry so a switched-off source keeps its
  // validators. A check that only looked at enabled entries would let the
  // collision sit in the file until the day the second one is switched on.
  it("rejects a slug reused by a disabled entry", () => {
    const dir = mkdtempSync(join(tmpdir(), "sift-src-"));
    const bad = join(dir, "sources.json");
    writeFileSync(
      bad,
      JSON.stringify([
        { slug: "newsroom", kind: "rss", url: "https://alpha.example/feed", topics: ["general"], enabled: true },
        { slug: "newsroom", kind: "rss", url: "https://beta.example/feed", topics: ["general"], enabled: false },
      ]),
    );
    expect(() => loadSources(bad)).toThrow(/duplicate source slug: newsroom/);
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
