import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseFrontmatter } from "../digest/frontmatter";
import { readSocial } from "../pipeline/social";
import { renderSheetHtml, renderSlideHtml, slideCards, slideMeta } from "./cards";

// Emits one html file per carousel card for a day's digest; the slides
// skill renders them to png (CLI: npm run slides -- {day}, default newest).
const invokedDirectly = process.argv[1]?.endsWith("build.ts") && process.argv[1]!.includes("slides");
if (invokedDirectly) {
  const root = resolve(".");
  const dir = join(root, "digests");
  const day =
    process.argv[2] ??
    readdirSync(dir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
      .sort()
      .at(-1)
      ?.slice(0, 10);
  if (!day || !existsSync(join(dir, `${day}.md`))) throw new Error(`no digest for ${day ?? "any day"}`);
  const { meta, body } = parseFrontmatter(readFileSync(join(dir, `${day}.md`), "utf8"));
  const cards = slideCards({ day, title: meta?.title ?? "", description: meta?.description ?? "", body });
  const out = join(root, "slides", day);
  mkdirSync(out, { recursive: true });
  cards.forEach((card, i) => {
    writeFileSync(join(out, `card-${i + 1}.html`), renderSlideHtml(card, i, cards.length));
  });
  writeFileSync(join(out, "sheet.html"), renderSheetHtml(day, cards.length));
  writeFileSync(join(out, "meta.json"), `${JSON.stringify(slideMeta(day, cards, readSocial(root, day)), null, 2)}\n`);
  console.log(JSON.stringify({ day, cards: cards.length, dir: `slides/${day}` }));
}
