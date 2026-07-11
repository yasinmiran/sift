import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { buildCards, renderSheetHtml, renderSlideHtml, slideMeta } from "./cards";
import { readSlidePosts } from "./data";

// Emits one html file per carousel card for each of a day's posts, plus a
// sheet.html preview and meta.json per post (CLI: npm run slides -- {day},
// default newest digest day).
const invokedDirectly = process.argv[1]?.endsWith("build.ts") && process.argv[1]!.includes("slides");
if (invokedDirectly) {
  const root = resolve(".");
  const day =
    process.argv[2] ??
    readdirSync(join(root, "digests"))
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
      .sort()
      .at(-1)
      ?.slice(0, 10);
  if (!day || !existsSync(join(root, "digests", `${day}.md`))) {
    throw new Error(`no digest for ${day ?? "any day"}`);
  }
  const dayPosts = readSlidePosts(root, day);
  if (!dayPosts) {
    throw new Error(`no data/slides/${day}.json; the digest agent scripts the carousel there (see AGENTS.md)`);
  }
  const written = dayPosts.posts.map((post) => {
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
  console.log(JSON.stringify({ day, posts: written, dir: `slides/${day}` }));
}
