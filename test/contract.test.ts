import { beforeAll, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildSite } from "../src/site/build";

// Tripwire for the yasint.dev handshake. The blog (private repo, not visible
// from here) emits links carrying the params below and keeps the canonical
// palette in its tailwind.config.mjs; sift mirrors both. A rename or retune
// on either side keeps both suites green unless it is pinned here, so pin it.
// Counterpart: yasint.dev tests/sift-contract.test.ts. Details: README.md.

// Canonical values copied from yasint.dev tailwind.config.mjs (theme.colors).
const PALETTE = [
  "#0d0c0b", // background
  "#1a1816", // surface
  "#2a2622", // border
  "#d4976a", // accent
  "#e8b08a", // accent-hover
  "#e8e2d9", // warm-50, headings
  "#d4cdc2", // warm-100, bold
  "#b8b0a3", // warm-200, prose body
  "#7a7268", // warm-400, muted chrome
  "#5c564e", // warm-500, faint
];

let index: string;
let day: string;

beforeAll(() => {
  const root = mkdtempSync(join(tmpdir(), "sift-contract-"));
  mkdirSync(join(root, "digests"), { recursive: true });
  writeFileSync(
    join(root, "digests", "2026-07-04.md"),
    '---\ntitle: "t"\ndescription: "d"\ndate: "2026-07-04"\n---\n\nbody\n',
  );
  buildSite(root, join(root, "site"));
  index = readFileSync(join(root, "site", "index.html"), "utf8");
  day = readFileSync(join(root, "site", "2026-07-04.html"), "utf8");
});

describe("yasint.dev contract", () => {
  it("consumes the ?today param the blog's callout emits", () => {
    expect(index).toContain('has("today")');
    expect(index).toContain("location.replace");
  });

  it("consumes the ?from param and returns visitors via the backlink", () => {
    for (const html of [index, day]) {
      expect(html).toContain('get("from")');
      expect(html).toContain('sessionStorage.setItem("sift-from"');
      expect(html).toContain('"https://yasint.dev" + back');
      expect(html).toContain('<a href="https://yasint.dev" data-backlink>yasin</a>');
    }
  });

  it("mirrors the yasint.dev palette (its tailwind config is canonical)", () => {
    for (const hex of PALETTE) {
      expect(index, `palette drifted: ${hex} missing; sync with yasint.dev tailwind.config.mjs`).toContain(hex);
    }
  });
});
