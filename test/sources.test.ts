import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadSources } from "../src/sources";

describe("source registry", () => {
  it("loads the checked-in registry, lane-free", () => {
    const sources = loadSources();
    expect(sources.length).toBeGreaterThanOrEqual(40);
    for (const s of sources) {
      expect(["hn", "rss", "web"]).toContain(s.kind);
      expect(s).not.toHaveProperty("lane");
    }
  });

  it("rejects a malformed entry", () => {
    const dir = mkdtempSync(join(tmpdir(), "sift-src-"));
    const bad = join(dir, "sources.json");
    writeFileSync(bad, JSON.stringify([{ slug: "x", kind: "carrier-pigeon", topics: [], enabled: true }]));
    expect(() => loadSources(bad)).toThrow(/invalid source entry/);
  });
});
