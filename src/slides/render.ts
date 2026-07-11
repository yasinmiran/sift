import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "playwright";

// Renders a day's card html to png at instagram's 1080x1350 (CLI:
// npm run slides:render -- {day}, default newest under slides/). This is
// the pages workflow's render path; needs a chromium from
// `npx playwright install chromium`.
const root = resolve(".");
const slidesDir = join(root, "slides");
const day =
  process.argv[2] ??
  readdirSync(slidesDir)
    .filter((f) => /^\d{4}-\d{2}-\d{2}$/.test(f))
    .sort()
    .at(-1);
if (!day || !existsSync(join(slidesDir, day))) {
  throw new Error(`no cards for ${day ?? "any day"}; run npm run slides first`);
}
const dir = join(slidesDir, day);
const cards = readdirSync(dir)
  .filter((f) => /^card-\d+\.html$/.test(f))
  .sort((a, b) => Number(/\d+/.exec(a)![0]) - Number(/\d+/.exec(b)![0]));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
for (const card of cards) {
  await page.goto(`file://${join(dir, card)}`);
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await page.screenshot({ path: join(dir, card.replace(".html", ".png")), scale: "css" });
}
await browser.close();
console.log(JSON.stringify({ day, rendered: cards.length }));
