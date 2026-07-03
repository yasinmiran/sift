import { beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cleanup } from "../src/cleanup";

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "sift-clean-"));
  mkdirSync(join(root, "digests"), { recursive: true });
  mkdirSync(join(root, "data", "items"), { recursive: true });
});

const touch = (p: string) => writeFileSync(join(root, p), "x");

describe("cleanup", () => {
  it("removes digests and item files older than the horizon, keeps the rest", () => {
    touch("digests/2026-05-01.md");
    touch("digests/2026-06-20.md");
    touch("data/items/2026-05-01.json");
    touch("data/items/2026-06-20.json");
    const { removed } = cleanup(root, "2026-07-04", 31);
    expect(removed.sort()).toEqual(["data/items/2026-05-01.json", "digests/2026-05-01.md"]);
    expect(existsSync(join(root, "digests/2026-06-20.md"))).toBe(true);
    expect(existsSync(join(root, "data/items/2026-06-20.json"))).toBe(true);
  });

  it("ignores non-dated files and missing folders", () => {
    touch("digests/.gitkeep");
    touch("data/items/state-backup.json");
    expect(cleanup(root, "2026-07-04", 31).removed).toEqual([]);
    const bare = mkdtempSync(join(tmpdir(), "sift-clean-"));
    expect(cleanup(bare, "2026-07-04", 31).removed).toEqual([]);
  });
});
