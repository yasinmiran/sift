import { beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  isSeen,
  itemKey,
  loadState,
  markSeen,
  pruneSeen,
  saveState,
  type IngestState,
} from "../src/pipeline/state";

let dataDir: string;
beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), "sift-state-"));
});

describe("ingest state", () => {
  it("defaults to empty state and round-trips it", () => {
    const state = loadState(dataDir);
    expect(state).toEqual({ sources: {}, seen: {} });
    state.sources.s = { etag: "x", lastModified: null, feedHash: null };
    saveState(dataDir, state);
    expect(loadState(dataDir).sources.s!.etag).toBe("x");
  });

  it("tracks seen keys across retained days and prunes past the window", () => {
    const state: IngestState = { sources: {}, seen: {} };
    markSeen(state, "2026-06-27", itemKey({ sourceSlug: "s", externalId: "e1" }));
    markSeen(state, "2026-07-04", "s:e2");
    expect(isSeen(state, "s:e1")).toBe(true);
    pruneSeen(state, "2026-07-04");
    expect(isSeen(state, "s:e1")).toBe(false);
    expect(isSeen(state, "s:e2")).toBe(true);
  });
});
