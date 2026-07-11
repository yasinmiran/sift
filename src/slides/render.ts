import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "playwright";

// Renders built card html to png at instagram's 1080x1350, one directory
// per post slot (CLI: npm run slides:render -- {day}; no day renders every
// built day under slides/). This is the pages workflow's render path; needs
// a chromium from `npx playwright install chromium`.
const root = resolve(".");
const slidesDir = join(root, "slides");
const requested = process.argv[2];
if (requested && !existsSync(join(slidesDir, requested))) {
  throw new Error(`no cards for ${requested}; run npm run slides first`);
}
const days = requested
  ? [requested]
  : existsSync(slidesDir)
    ? readdirSync(slidesDir)
        .filter((f) => /^\d{4}-\d{2}-\d{2}$/.test(f))
        .sort()
    : [];

const rendered: Record<string, number> = {};
if (days.length > 0) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
    for (const day of days) {
      const slots = readdirSync(join(slidesDir, day), { withFileTypes: true })
        .filter((e) => e.isDirectory() && /^(am|pm)$/.test(e.name))
        .map((e) => e.name);
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
        rendered[`${day}/${slot}`] = cards.length;
      }
    }
  } finally {
    await browser.close();
  }
}
console.log(JSON.stringify({ rendered }));
