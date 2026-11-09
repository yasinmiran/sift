import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

// Renders built card html to png at instagram's 1080x1350, one directory
// per post slot (CLI: npm run slides:render -- {day}; no day renders every
// built day under slides/). This is the pages workflow's render path; needs
// a chromium from `npx playwright install chromium`.

/** The slice of playwright this module drives, so a test can stand in for it. */
export interface ShotPage {
  goto(url: string): Promise<unknown>;
  evaluate(expression: string): Promise<unknown>;
  screenshot(options: { path: string; scale: "css" }): Promise<unknown>;
}
export interface ShotBrowser {
  newPage(options: { viewport: { width: number; height: number } }): Promise<ShotPage>;
  close(): Promise<void>;
}
export type Launch = () => Promise<ShotBrowser>;

// Imported where it is used, not at the top: `npm test` runs in checks.yml and
// ingest.yml without `playwright install`, and a static import would load the
// browser package into every test run that touches this module.
const launchChromium: Launch = async () => (await import("playwright")).chromium.launch();

/**
 * Photographs every built card under slides/, or one day's. The slot filter
 * and the card glob are what keep sheet.html, meta.json and any other
 * directory out of the png set the pages workflow publishes.
 */
export async function renderSlides(
  root: string,
  requested?: string,
  launch: Launch = launchChromium,
): Promise<{ rendered: Record<string, number> }> {
  const slidesDir = join(root, "slides");
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
  if (days.length === 0) return { rendered };

  const browser = await launch();
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
  return { rendered };
}

const invokedDirectly = process.argv[1]?.endsWith("render.ts");
if (invokedDirectly) {
  console.log(JSON.stringify(await renderSlides(resolve("."), process.argv[2])));
}
