import { beforeEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { verifyDigest } from "../src/verify";

const DAY = "2026-07-04";

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "sift-verify-"));
  mkdirSync(join(root, "digests"), { recursive: true });
  mkdirSync(join(root, "data", "items"), { recursive: true });
});

const urls = Array.from({ length: 10 }, (_, i) => `https://example.com/story-${i}`);

const writeItems = (day: string, itemUrls: string[]) =>
  writeFileSync(
    join(root, "data", "items", `${day}.json`),
    JSON.stringify({
      day,
      generatedAt: "2026-07-04T04:00:00.000Z",
      items: itemUrls.map((url, i) => ({ sourceSlug: "src", externalId: String(i), title: `t${i}`, url })),
    }),
  );

const digestWith = (opts: { front?: string; links?: string[]; threads?: string } = {}) => {
  const front =
    opts.front ??
    `---\ntitle: "The day's tech, sifted: Jul 4, 2026"\ndescription: "one line"\ndate: "${DAY}"\n---`;
  const links = opts.links ?? urls;
  const threads = opts.threads ?? "\n## Threads\n\n- story-0 and story-1 share a vendor.\n";
  return `${front}\n\nWhat matters today.\n\n## AI / LLMs\n\n${links
    .map((u, i) => `- [Story ${i}](${u}) matters.`)
    .join("\n")}\n${threads}`;
};

const writeDigest = (content: string, day = DAY) =>
  writeFileSync(join(root, "digests", `${day}.md`), content);

describe("verifyDigest", () => {
  it("passes a well-formed digest whose links all come from the day's items", () => {
    writeItems(DAY, urls);
    writeDigest(digestWith());
    const r = verifyDigest(root, DAY);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("fails when the digest file does not exist", () => {
    const r = verifyDigest(root, DAY);
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toContain("does not exist");
  });

  it("fails on missing frontmatter keys and a date/filename mismatch", () => {
    writeItems(DAY, urls);
    writeDigest(digestWith({ front: `---\ntitle: "t"\ndate: "2026-07-03"\n---` }));
    const r = verifyDigest(root, DAY);
    expect(r.ok).toBe(false);
    expect(r.errors).toContainEqual(expect.stringContaining("description"));
    expect(r.errors).toContainEqual(expect.stringContaining("2026-07-03"));
  });

  it("fails on non-http links", () => {
    writeItems(DAY, urls);
    writeDigest(digestWith({ links: [...urls, "digests/2026-07-03.md"] }));
    const r = verifyDigest(root, DAY);
    expect(r.ok).toBe(false);
    expect(r.errors).toContainEqual(expect.stringContaining("digests/2026-07-03.md"));
  });

  it("warns on links that match no item url, tolerating trailing slashes", () => {
    writeItems(DAY, urls);
    writeDigest(digestWith({ links: [...urls.slice(1), `${urls[0]}/`, "https://elsewhere.org/primary"] }));
    const r = verifyDigest(root, DAY);
    expect(r.ok).toBe(true);
    expect(r.warnings).toEqual([expect.stringContaining("https://elsewhere.org/primary")]);
  });

  it("warns when the Threads section is missing and when the digest is thin", () => {
    writeItems(DAY, urls.slice(0, 2));
    writeDigest(digestWith({ links: urls.slice(0, 2), threads: "" }));
    const r = verifyDigest(root, DAY);
    expect(r.ok).toBe(true);
    expect(r.warnings).toContainEqual(expect.stringContaining("Threads"));
    expect(r.warnings).toContainEqual(expect.stringContaining("2 links"));
  });

  it("warns when the items file is missing instead of failing", () => {
    writeDigest(digestWith());
    const r = verifyDigest(root, DAY);
    expect(r.ok).toBe(true);
    expect(r.warnings).toEqual([expect.stringContaining("cannot cross-check")]);
  });
});
