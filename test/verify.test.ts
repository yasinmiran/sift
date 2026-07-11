import { beforeEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { verifyDigest } from "../src/digest/verify";

const DAY = "2026-07-04";

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "sift-verify-"));
  mkdirSync(join(root, "digests"), { recursive: true });
  mkdirSync(join(root, "data", "items"), { recursive: true });
  mkdirSync(join(root, "data", "social"), { recursive: true });
  mkdirSync(join(root, "config"), { recursive: true });
  writeFileSync(
    join(root, "config", "social.json"),
    JSON.stringify({ hashtags: ["#tech", "#ai", "#infosec", "#devtools"] }),
  );
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

const digestWith = (opts: { front?: string; links?: string[]; threads?: string; hn?: string } = {}) => {
  const front =
    opts.front ??
    `---\ntitle: "The day's tech, sifted: Jul 4, 2026"\ndescription: "one line"\ndate: "${DAY}"\n---`;
  const links = opts.links ?? urls;
  const hn = opts.hn ?? "\n## Hacker News\n\nThe front page argued about [Story 0](https://example.com/story-0).\n";
  const threads = opts.threads ?? "\n## Threads\n\n- story-0 and story-1 share a vendor.\n";
  return `${front}\n\nWhat matters today.\n\n## AI / LLMs\n\n${links
    .map((u, i) => `- [Story ${i}](${u}) matters.`)
    .join("\n")}\n${hn}${threads}`;
};

const writeDigest = (content: string, day = DAY) =>
  writeFileSync(join(root, "digests", `${day}.md`), content);

const writeSocial = (over: Record<string, unknown> = {}) =>
  writeFileSync(
    join(root, "data", "social", `${DAY}.json`),
    JSON.stringify({
      day: DAY,
      caption: "apple sues openai over trade secrets. full digest at sift.yasint.dev (link in bio)",
      hashtags: ["#tech", "#ai", "#infosec"],
      ...over,
    }),
  );

describe("verifyDigest", () => {
  it("treats pick urls as known links and warns when one is not covered", () => {
    writeItems(DAY, urls);
    mkdirSync(join(root, "data", "picks"), { recursive: true });
    writeFileSync(
      join(root, "data", "picks", `${DAY}.json`),
      JSON.stringify({
        day: DAY,
        items: [
          { url: "https://found.example/a", addedAt: "2026-07-04T09:00:00Z" },
          { url: "https://found.example/missing", addedAt: "2026-07-04T09:00:00Z" },
        ],
      }),
    );
    writeDigest(digestWith({ links: [...urls, "https://found.example/a"] }));
    const r = verifyDigest(root, DAY);
    expect(r.errors).toEqual([]);
    expect(r.warnings.some((w) => w.includes("found.example/a"))).toBe(false);
    expect(r.warnings.some((w) => w.includes("pick not covered: https://found.example/missing"))).toBe(true);
  });

  it("fails on a malformed picks file", () => {
    writeItems(DAY, urls);
    mkdirSync(join(root, "data", "picks"), { recursive: true });
    writeFileSync(join(root, "data", "picks", `${DAY}.json`), JSON.stringify({ day: DAY, items: "nope" }));
    writeDigest(digestWith());
    const r = verifyDigest(root, DAY);
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toContain("picks");
  });

  it("passes a well-formed digest whose links all come from the day's items", () => {
    writeItems(DAY, urls);
    writeDigest(digestWith());
    writeSocial();
    const r = verifyDigest(root, DAY);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("fails on unclosed pen marks but not on prose parens", () => {
    writeItems(DAY, urls);
    writeDigest(digestWith({ threads: "\n## Threads\n\n- a ==real (nested (parens)) deal== here.\n" }));
    expect(verifyDigest(root, DAY).errors).toEqual([]);
    writeDigest(digestWith({ threads: "\n## Threads\n\n- an ==unclosed mark here.\n" }));
    expect(verifyDigest(root, DAY).errors[0]).toContain("==");
    writeDigest(digestWith({ threads: "\n## Threads\n\n- a ((dangling circle here.\n" }));
    expect(verifyDigest(root, DAY).errors[0]).toContain("((");
  });

  it("warns when marks are overused and ignores == inside link urls", () => {
    writeItems(DAY, urls);
    writeDigest(
      digestWith({
        threads:
          "\n## Threads\n\n- ==one== ==two== ==three== ((four)) connect via [x](https://e.com/?t=YWJjZA==).\n",
      }),
    );
    const r = verifyDigest(root, DAY);
    expect(r.errors).toEqual([]);
    expect(r.warnings.some((w) => w.includes("marks"))).toBe(true);
  });

  it("fails on pen marks in the frontmatter", () => {
    writeItems(DAY, urls);
    writeDigest(
      digestWith({
        front: `---\ntitle: "The day's tech, sifted: Jul 4, 2026"\ndescription: "a ==marked== line"\ndate: "${DAY}"\n---`,
      }),
    );
    const r = verifyDigest(root, DAY);
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toContain("description");
  });

  it("allows yaml quote escapes but fails on ones the site renders literally", () => {
    writeItems(DAY, urls);
    writeDigest(
      digestWith({
        front: `---\ntitle: "The day's tech, sifted: Jul 4, 2026"\ndescription: "thinks \\"blackmail\\" quietly"\ndate: "${DAY}"\n---`,
      }),
    );
    expect(verifyDigest(root, DAY).errors).toEqual([]);
    writeDigest(
      digestWith({
        front: `---\ntitle: "The day's tech, sifted: Jul 4, 2026"\ndescription: "line one\\nline two"\ndate: "${DAY}"\n---`,
      }),
    );
    const r = verifyDigest(root, DAY);
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toContain("description");
    expect(r.errors[0]).toContain("escape");
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
    writeSocial();
    const r = verifyDigest(root, DAY);
    expect(r.ok).toBe(true);
    expect(r.warnings).toEqual([expect.stringContaining("https://elsewhere.org/primary")]);
  });

  it("warns when the Threads or Hacker News section is missing and when the digest is thin", () => {
    writeItems(DAY, urls.slice(0, 2));
    writeDigest(digestWith({ links: urls.slice(0, 2), threads: "", hn: "" }));
    const r = verifyDigest(root, DAY);
    expect(r.ok).toBe(true);
    expect(r.warnings).toContainEqual(expect.stringContaining("Threads"));
    expect(r.warnings).toContainEqual(expect.stringContaining("Hacker News"));
    expect(r.warnings).toContainEqual(expect.stringContaining("2 links"));
  });

  it("warns on em and en dashes in the body", () => {
    writeItems(DAY, urls);
    writeDigest(digestWith({ threads: "\n## Threads\n\n- story-0 — story-1, via – a vendor.\n" }));
    writeSocial();
    const r = verifyDigest(root, DAY);
    expect(r.ok).toBe(true);
    expect(r.warnings).toEqual([expect.stringContaining("em/en dashes")]);
  });

  it("warns when the items file is missing instead of failing", () => {
    writeDigest(digestWith());
    writeSocial();
    const r = verifyDigest(root, DAY);
    expect(r.ok).toBe(true);
    expect(r.warnings).toEqual([expect.stringContaining("cannot cross-check")]);
  });

  it("warns when the day has no social caption", () => {
    writeItems(DAY, urls);
    writeDigest(digestWith());
    const r = verifyDigest(root, DAY);
    expect(r.ok).toBe(true);
    expect(r.warnings).toContainEqual(expect.stringContaining("data/social"));
  });

  it("fails a caption that skips the pointer home, links raw or @-mentions", () => {
    writeItems(DAY, urls);
    writeDigest(digestWith());
    writeSocial({ caption: "apple sues openai, see https://example.com and thanks @openai" });
    const r = verifyDigest(root, DAY);
    expect(r.ok).toBe(false);
    expect(r.errors).toContainEqual(expect.stringContaining("point home"));
    expect(r.errors).toContainEqual(expect.stringContaining("raw url"));
    expect(r.errors).toContainEqual(expect.stringContaining("@-mentions"));
  });

  it("fails hashtags outside the pool, bad format, wrong count or duplicates", () => {
    writeItems(DAY, urls);
    writeDigest(digestWith());
    writeSocial({ hashtags: ["#Tech!", "#notinpool"] });
    let r = verifyDigest(root, DAY);
    expect(r.errors).toContainEqual(expect.stringContaining("not lowercase"));
    expect(r.errors).toContainEqual(expect.stringContaining("never invent one"));
    expect(r.errors).toContainEqual(expect.stringContaining("pick 3-6"));
    writeSocial({ hashtags: ["#tech", "#tech", "#ai"] });
    r = verifyDigest(root, DAY);
    expect(r.errors).toEqual([expect.stringContaining("duplicate hashtags")]);
  });

  it("warns on uppercase, emoji and foreign domains in the caption", () => {
    writeItems(DAY, urls);
    writeDigest(digestWith());
    writeSocial({ caption: "Apple sues OpenAI 🚨 via bloomberg.com. full digest at sift.yasint.dev (link in bio)" });
    const r = verifyDigest(root, DAY);
    expect(r.ok).toBe(true);
    expect(r.warnings).toContainEqual(expect.stringContaining("uppercase"));
    expect(r.warnings).toContainEqual(expect.stringContaining("emoji"));
    expect(r.warnings).toContainEqual(expect.stringContaining("bloomberg.com"));
  });

  it("fails an over-long caption and surfaces a malformed social file", () => {
    writeItems(DAY, urls);
    writeDigest(digestWith());
    writeSocial({ caption: `${"a".repeat(500)}. full digest at sift.yasint.dev (link in bio)` });
    expect(verifyDigest(root, DAY).errors).toEqual([expect.stringContaining("500")]);
    writeSocial({ hashtags: "nope" });
    const r = verifyDigest(root, DAY);
    expect(r.ok).toBe(false);
    expect(r.errors).toEqual([expect.stringContaining("data/social")]);
  });

  it("warns on links already used by an earlier digest, ignoring later ones", () => {
    writeItems(DAY, urls);
    writeDigest(digestWith({ links: [urls[0]!], hn: "" }), "2026-07-02");
    writeDigest(digestWith({ links: [`${urls[1]}/`], hn: "" }), "2026-07-03");
    writeDigest(digestWith({ links: [urls[2]!], hn: "" }), "2026-07-05");
    writeDigest(digestWith());
    const r = verifyDigest(root, DAY);
    expect(r.ok).toBe(true);
    expect(r.warnings).toContainEqual(expect.stringContaining(`already digested on 2026-07-02: ${urls[0]}`));
    expect(r.warnings).toContainEqual(expect.stringContaining(`already digested on 2026-07-03: ${urls[1]}`));
    expect(r.warnings).not.toContainEqual(expect.stringContaining(urls[2]!));
  });
});
