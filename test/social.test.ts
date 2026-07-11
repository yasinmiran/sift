import { beforeEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readHashtagPool, readSocial } from "../src/pipeline/social";

const DAY = "2026-07-11";

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "sift-social-"));
  mkdirSync(join(root, "data", "social"), { recursive: true });
  mkdirSync(join(root, "config"), { recursive: true });
});

const write = (content: unknown) =>
  writeFileSync(join(root, "data", "social", `${DAY}.json`), JSON.stringify(content));

describe("readSocial", () => {
  it("reads a valid day", () => {
    write({ day: DAY, caption: "gpt-6 lands. full digest at sift.yasint.dev (link in bio)", hashtags: ["#ai"] });
    expect(readSocial(root, DAY)?.caption).toContain("gpt-6");
  });

  it("returns null when the day has none", () => {
    expect(readSocial(root, DAY)).toBeNull();
  });

  it("throws on a day mismatch", () => {
    write({ day: "2026-07-10", caption: "x", hashtags: [] });
    expect(() => readSocial(root, DAY)).toThrow(/does not match the filename/);
  });

  it("throws on a missing or empty caption", () => {
    write({ day: DAY, hashtags: [] });
    expect(() => readSocial(root, DAY)).toThrow(/caption/);
    write({ day: DAY, caption: "   ", hashtags: [] });
    expect(() => readSocial(root, DAY)).toThrow(/caption/);
  });

  it("throws when hashtags is not an array of strings", () => {
    write({ day: DAY, caption: "x", hashtags: "#ai" });
    expect(() => readSocial(root, DAY)).toThrow(/hashtags/);
    write({ day: DAY, caption: "x", hashtags: ["#ai", 3] });
    expect(() => readSocial(root, DAY)).toThrow(/hashtags/);
  });
});

describe("readHashtagPool", () => {
  it("reads the curated pool from config", () => {
    writeFileSync(join(root, "config", "social.json"), JSON.stringify({ hashtags: ["#tech", "#ai"] }));
    expect(readHashtagPool(root)).toEqual(new Set(["#tech", "#ai"]));
  });
});
