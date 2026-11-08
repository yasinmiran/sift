import { beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildSlides } from "../src/slides/build";
import type { SlidePost } from "../src/slides/data";

const DAY = "2026-07-03";

const newRoot = () => {
  const dir = mkdtempSync(join(tmpdir(), "sift-slides-build-"));
  mkdirSync(join(dir, "digests"), { recursive: true });
  mkdirSync(join(dir, "data", "slides"), { recursive: true });
  return dir;
};

let root: string;
beforeEach(() => {
  root = newRoot();
});

// A day is only built when it still has a digest in the archive.
const digest = (at: string, day: string) =>
  writeFileSync(
    join(at, "digests", `${day}.md`),
    `---\ntitle: "The day's tech, sifted: ${day}"\ndescription: "top story of ${day}"\ndate: "${day}"\n---\n\nbody [link](https://example.com/a)\n`,
  );

const post = (slot: "am" | "pm", stories: number): SlidePost => ({
  slot,
  hook: `the ${slot} hook`,
  caption: "what happened. full digest at sift.yasint.dev (link in bio)",
  hashtags: ["#ai"],
  slides: Array.from({ length: stories }, (_, i) => ({
    number: i + 1,
    category: "ai / llms",
    title: `story ${i + 1}`,
    desc: `why story ${i + 1} matters`,
    url: `https://example.com/${slot}-${i + 1}`,
  })),
});

const script = (at: string, day: string, posts: SlidePost[]) =>
  writeFileSync(join(at, "data", "slides", `${day}.json`), `${JSON.stringify({ day, posts }, null, 2)}\n`);

// Every file under a directory, by path and size: the built tree, comparable
// across two roots.
const tree = (dir: string): string[] =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true })
        .flatMap((e) =>
          e.isDirectory()
            ? tree(join(dir, e.name)).map((line) => `${e.name}/${line}`)
            : [`${e.name} ${readFileSync(join(dir, e.name), "utf8").length}`],
        )
        .sort()
    : [];

const cards = (at: string, day: string, slot: string) =>
  existsSync(join(at, "slides", day, slot))
    ? readdirSync(join(at, "slides", day, slot)).filter((f) => /^card-\d+\.html$/.test(f))
    : [];

describe("buildSlides", () => {
  it("writes a card per slide plus a cover and a cta, with the sheet and meta", () => {
    digest(root, DAY);
    script(root, DAY, [post("am", 3)]);

    expect(buildSlides(root)).toEqual({ days: 1, built: [{ day: DAY, posts: [{ slot: "am", cards: 5 }] }] });
    expect(cards(root, DAY, "am").length).toBe(5);
    expect(readdirSync(join(root, "slides", DAY, "am")).sort()).toContain("meta.json");
  });

  // The evening run rewrites a slot by design, and a build that writes into
  // the previous build's output keeps whatever the new script dropped: the
  // cards of a shrunken post, and the whole directory of a retired slot.
  // render.ts globs card-*.html out of the post directory and enumerates the
  // slot directories under the day, so both leftovers get photographed and
  // copied into the site beside a meta.json that never names them. Asserted
  // as the invariant rather than as either symptom, by building the same
  // script twice in two ways: into a directory a wider script already
  // filled, and into a fresh one. The two have to come out identical, which
  // is the whole of "slides/{day}/ is a function of data/slides/{day}.json".
  it("builds the same tree whether or not a wider script built here first", () => {
    digest(root, DAY);
    script(root, DAY, [post("am", 4), post("pm", 3)]);
    buildSlides(root);
    expect(cards(root, DAY, "am").length).toBe(6);
    expect(readdirSync(join(root, "slides", DAY)).sort()).toEqual(["am", "pm"]);

    script(root, DAY, [post("am", 2)]);
    buildSlides(root);

    const fresh = newRoot();
    digest(fresh, DAY);
    script(fresh, DAY, [post("am", 2)]);
    buildSlides(fresh);

    expect(tree(join(root, "slides"))).toEqual(tree(join(fresh, "slides")));
    expect(cards(root, DAY, "am").length).toBe(4);
    expect(readdirSync(join(root, "slides", DAY))).toEqual(["am"]);
  });

  // Only the days in the build list are cleared. A day whose digest has
  // rolled out of the archive is not built, so the posts it already
  // published survive later deploys, which is what the file promises.
  it("leaves a day it is not building alone", () => {
    const earlier = "2026-07-02";
    digest(root, earlier);
    digest(root, DAY);
    script(root, earlier, [post("am", 2)]);
    script(root, DAY, [post("am", 2)]);
    buildSlides(root);
    expect(readdirSync(join(root, "slides")).sort()).toEqual([earlier, DAY]);

    const before = tree(join(root, "slides", earlier));
    const { days } = buildSlides(root, DAY);

    expect(days).toBe(1);
    expect(tree(join(root, "slides", earlier))).toEqual(before);
  });

  it("refuses a requested day the agent has not scripted", () => {
    digest(root, DAY);
    expect(() => buildSlides(root, DAY)).toThrow(/no data\/slides\/2026-07-03\.json/);
  });
});
