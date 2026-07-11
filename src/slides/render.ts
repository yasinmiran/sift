import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "playwright";

// Renders a day's card html to png at instagram's 1080x1350, one directory
// per post slot (CLI: npm run slides:render -- {day}, default newest under
// slides/). This is the pages workflow's render path; needs a chromium from
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
const slots = readdirSync(join(slidesDir, day), { withFileTypes: true })
  .filter((e) => e.isDirectory() && /^(am|pm)$/.test(e.name))
  .map((e) => e.name);
if (slots.length === 0) throw new Error(`no post directories under slides/${day}; run npm run slides first`);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
const rendered: Record<string, number> = {};
for (const slot of slots) {
  const dir = join(slidesDir, day, slot);
  const cards = readdirSync(dir)
    .filter((f) => /^card-\d+\.html$/.test(f))
    .sort((a, b) => Number(/\d+/.exec(a)![0]) - Number(/\d+/.exec(b)![0]));
  for (const card of cards) {
    await page.goto(`file://${join(dir, card)}`);
    await page.evaluate("document.fonts.ready.then(() => true)");
    await page.screenshot({ path: join(dir, card.replace(".html", ".png")), scale: "css" });
  }
  rendered[slot] = cards.length;
}
await browser.close();
console.log(JSON.stringify({ day, rendered }));
