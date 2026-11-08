import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { buildCards, renderSheetHtml, renderSlideHtml, slideMeta } from "./cards";
import { readSlidePosts } from "./data";

// Emits one html file per carousel card, plus a sheet.html preview and
// meta.json per post (CLI: npm run slides -- {day}; no day builds every
// scripted day that still has a digest, so published posts survive later
// deploys until the rolling month prunes them).
export function buildSlides(root: string, requested?: string) {
  const dataDir = join(root, "data", "slides");
  if (requested && !readSlidePosts(root, requested)) {
    throw new Error(`no data/slides/${requested}.json; the digest agent scripts the carousel there (see AGENTS.md)`);
  }
  const days = requested
    ? [requested]
    : existsSync(dataDir)
      ? readdirSync(dataDir)
          .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
          .map((f) => f.slice(0, 10))
          .filter((day) => existsSync(join(root, "digests", `${day}.md`)))
          .sort()
      : [];
  const built = days.map((day) => {
    const dayPosts = readSlidePosts(root, day)!;
    // slides/{day}/ is a function of data/slides/{day}.json, so clear it
    // rather than writing into the last build: the evening run rewrites a
    // slot by design, and a post that loses cards used to keep the dropped
    // ones on disk, where render.ts globs card-*.html and photographs every
    // one it finds. Clearing the day, not the post, also retires a slot the
    // script no longer holds, which render.ts would otherwise enumerate.
    // Only days in the build list are cleared, so a day whose digest has
    // rolled out of the archive keeps the posts it already published.
    const dayOut = join(root, "slides", day);
    rmSync(dayOut, { recursive: true, force: true });
    const posts = dayPosts.posts.map((post) => {
      const out = join(dayOut, post.slot);
      mkdirSync(out, { recursive: true });
      const cards = buildCards(day, post);
      cards.forEach((card, i) => {
        writeFileSync(join(out, `card-${i + 1}.html`), renderSlideHtml(card, i, cards.length));
      });
      const meta = slideMeta(day, post, cards);
      writeFileSync(join(out, "sheet.html"), renderSheetHtml(`${day} ${post.slot}`, meta.cards));
      writeFileSync(join(out, "meta.json"), `${JSON.stringify(meta, null, 2)}\n`);
      return { slot: post.slot, cards: cards.length };
    });
    return { day, posts };
  });
  return { days: built.length, built };
}

const invokedDirectly = process.argv[1]?.endsWith("build.ts") && process.argv[1]!.includes("slides");
if (invokedDirectly) {
  console.log(JSON.stringify(buildSlides(resolve("."), process.argv[2])));
}
