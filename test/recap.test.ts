import { beforeEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { recap } from "../src/digest/recap";

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "sift-recap-"));
  mkdirSync(join(root, "digests"), { recursive: true });
});

const digest = (day: string) =>
  writeFileSync(
    join(root, "digests", `${day}.md`),
    `---\ntitle: "sift: ${day}"\ndescription: "biggest story of ${day}"\ndate: "${day}"\n---\n\n**What matters today:** the lead of ${day}\nspanning two lines.\n\n## AI / LLMs\n\n- [story](https://e.com) rest of the digest.\n`,
  );

describe("recap", () => {
  it("returns the latest earlier day's description and lead only", () => {
    digest("2026-07-03");
    digest("2026-07-05");
    const r = recap(root, "2026-07-06");
    expect(r).toEqual({
      day: "2026-07-05",
      description: "biggest story of 2026-07-05",
      lead: "**What matters today:** the lead of 2026-07-05\nspanning two lines.",
    });
  });

  it("skips the day itself and jumps gaps", () => {
    digest("2026-07-03");
    digest("2026-07-05");
    expect(recap(root, "2026-07-05")?.day).toBe("2026-07-03");
  });

  it("returns null when no earlier day exists", () => {
    digest("2026-07-05");
    expect(recap(root, "2026-07-05")).toBeNull();
    expect(recap(join(root, "nowhere"), "2026-07-05")).toBeNull();
  });
});
