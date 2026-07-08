import { beforeEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyPick, pickDay, pickFromIssue, readPicks } from "../src/pipeline/picks";

const DAY = "2026-07-08";

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "sift-picks-"));
  mkdirSync(join(root, "data", "picks"), { recursive: true });
});

const write = (content: unknown, day = DAY) =>
  writeFileSync(join(root, "data", "picks", `${day}.json`), JSON.stringify(content));

describe("readPicks", () => {
  it("returns null when the day has no picks", () => {
    expect(readPicks(root, DAY)).toBeNull();
  });

  it("parses a valid picks file", () => {
    write({
      day: DAY,
      summary: "why today's finds matter",
      items: [{ url: "https://e.com/a", note: "neat", addedAt: "2026-07-08T09:00:00Z" }],
    });
    const picks = readPicks(root, DAY);
    expect(picks?.summary).toBe("why today's finds matter");
    expect(picks?.items[0]?.url).toBe("https://e.com/a");
  });

  it("throws named errors on malformed files", () => {
    write({ day: "2026-01-01", items: [] });
    expect(() => readPicks(root, DAY)).toThrow(/day/);
    write({ day: DAY, items: [{ note: "no url", addedAt: "x" }] });
    expect(() => readPicks(root, DAY)).toThrow(/url/);
    write({ day: DAY, items: "nope" });
    expect(() => readPicks(root, DAY)).toThrow(/items/);
  });
});

describe("applyPick", () => {
  const pick = { url: "https://e.com/a", addedAt: "2026-07-08T09:00:00Z" };

  it("starts a day file and appends", () => {
    const { picks, added } = applyPick(null, DAY, pick);
    expect(added).toBe(true);
    expect(picks).toEqual({ day: DAY, items: [pick] });
  });

  it("dedupes on the normalized url and keeps the summary", () => {
    const existing = { day: DAY, summary: "s", items: [pick] };
    const { picks, added } = applyPick(existing, DAY, { ...pick, url: "https://e.com/a/" });
    expect(added).toBe(false);
    expect(picks).toBe(existing);
  });
});

describe("pickFromIssue", () => {
  it("takes the url from the title and the note from the body", () => {
    const p = pickFromIssue({
      title: "pick: https://e.com/read",
      body: "found while scrolling",
      created_at: "2026-07-08T09:00:00Z",
    });
    expect(p).toEqual({
      url: "https://e.com/read",
      note: "found while scrolling",
      addedAt: "2026-07-08T09:00:00Z",
      day: "2026-07-08",
    });
  });

  it("keeps a text title and finds the url in the body", () => {
    const p = pickFromIssue({
      title: "pick: neat wasm trick",
      body: "https://e.com/wasm worth a read",
      created_at: "2026-07-08T09:00:00Z",
    });
    expect(p.title).toBe("neat wasm trick");
    expect(p.url).toBe("https://e.com/wasm");
    expect(p.note).toBe("worth a read");
  });

  it("rejects an issue without a url", () => {
    expect(() =>
      pickFromIssue({ title: "pick: just words", body: "", created_at: "2026-07-08T09:00:00Z" }),
    ).toThrow(/url/);
  });
});

describe("ensureScheme", () => {
  it("prepends https to scheme-less urls and keeps full ones", async () => {
    const { ensureScheme } = await import("../src/pipeline/picks");
    expect(ensureScheme("github.com/ogulcancelik/herdr")).toBe("https://github.com/ogulcancelik/herdr");
    expect(ensureScheme("https://e.com/a")).toBe("https://e.com/a");
    expect(ensureScheme("http://e.com/a")).toBe("http://e.com/a");
  });
});

describe("pickDay", () => {
  it("lands before the evening run on the same day", () => {
    expect(pickDay("2026-07-08T10:00:00Z")).toBe("2026-07-08");
    expect(pickDay("2026-07-08T03:00:00Z")).toBe("2026-07-08");
  });

  it("lands after the evening run on the next day", () => {
    expect(pickDay("2026-07-08T17:00:00Z")).toBe("2026-07-09");
    expect(pickDay("2026-07-08T22:30:00Z")).toBe("2026-07-09");
    expect(pickDay("2026-07-31T20:00:00Z")).toBe("2026-08-01");
  });
});
