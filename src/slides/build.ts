import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { buildCards, renderSheetHtml, renderSlideHtml, slideMeta } from "./cards";
import { readSlidePosts } from "./data";

// Emits one html file per carousel card, plus a sheet.html preview and
// meta.json per post (CLI: npm run slides -- {day}; no day builds every
// scripted day that still has a digest, so published posts survive later
// deploys until the rolling month prunes them).
const invokedDirectly = process.argv[1]?.endsWith("build.ts") && process.argv[1]!.includes("slides");
if (invokedDirectly) {
  const root = resolve(".");
  const dataDir = join(root, "data", "slides");
  const requested = process.argv[2];
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
    const posts = dayPosts.posts.map((post) => {
      const out = join(root, "slides", day, post.slot);
      mkdirSync(out, { recursive: true });
      const cards = buildCards(day, post);
      cards.forEach((card, i) => {
        writeFileSync(join(out, `card-${i + 1}.html`), renderSlideHtml(card, i, cards.length));
      });
      writeFileSync(join(out, "sheet.html"), renderSheetHtml(`${day} ${post.slot}`, cards.length));
      writeFileSync(join(out, "meta.json"), `${JSON.stringify(slideMeta(day, post, cards), null, 2)}\n`);
      return { slot: post.slot, cards: cards.length };
    });
    return { day, posts };
  });
  console.log(JSON.stringify({ days: built.length, built }));
}
