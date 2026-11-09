import { describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderSlides, type Launch, type ShotBrowser, type ShotPage } from "../src/slides/render";

// The renderer decides WHICH files get photographed, and the pages workflow
// publishes every png it finds beside the cards. The whole slides step runs
// under continue-on-error, so a widened glob or slot filter would ship with
// the deploy still green. A stub browser drives that decision without a
// chromium, which npm test has in neither checks.yml nor ingest.yml.
const stub = () => {
  const shots: { url: string; path: string; scale: string }[] = [];
  const viewports: { width: number; height: number }[] = [];
  const state = { launched: 0, closed: 0 };
  let at = "";
  const page: ShotPage = {
    goto: async (url) => void (at = url),
    evaluate: async () => true,
    screenshot: async ({ path, scale }) => void shots.push({ url: at, path, scale }),
  };
  const browser: ShotBrowser = {
    newPage: async ({ viewport }) => (viewports.push(viewport), page),
    close: async () => void (state.closed += 1),
  };
  const launch: Launch = async () => (state.launched += 1, browser);
  return { launch, shots, viewports, state, page };
};

const newRoot = () => mkdtempSync(join(tmpdir(), "sift-slides-render-"));

// Everything else a real post directory holds is written too: none of it is a
// card, and a png of either would be copied into site/slides/ beside them.
const cards = (root: string, day: string, slot: string, n: number) => {
  const dir = join(root, "slides", day, slot);
  mkdirSync(dir, { recursive: true });
  for (let i = 1; i <= n; i++) writeFileSync(join(dir, `card-${i}.html`), `<p>${day} ${slot} ${i}</p>`);
  writeFileSync(join(dir, "sheet.html"), "<p>preview</p>");
  writeFileSync(join(dir, "meta.json"), "{}\n");
};

describe("renderSlides", () => {
  it("photographs every card and nothing else in the directory, at instagram's size", async () => {
    const root = newRoot();
    cards(root, "2026-07-03", "am", 3);
    const s = stub();

    const { rendered } = await renderSlides(root, undefined, s.launch);

    expect(rendered).toEqual({ "2026-07-03/am": 3 });
    expect(s.shots.map((x) => x.path)).toEqual(
      [1, 2, 3].map((n) => join(root, "slides", "2026-07-03", "am", `card-${n}.png`)),
    );
    expect(s.shots.some((x) => /sheet|meta/.test(x.url))).toBe(false);
    expect(s.viewports).toEqual([{ width: 1080, height: 1350 }]);
    expect(s.shots.every((x) => x.scale === "css")).toBe(true);
  });

  it("takes the days in order on one browser, and skips anything that is not a day", async () => {
    const root = newRoot();
    cards(root, "2026-07-04", "am", 1);
    cards(root, "2026-07-03", "pm", 2);
    // Cards under it too, so the day filter is the only thing that can keep
    // it out of the render.
    cards(root, "scratch", "am", 1);
    const s = stub();

    const { rendered } = await renderSlides(root, undefined, s.launch);

    expect(Object.keys(rendered)).toEqual(["2026-07-03/pm", "2026-07-04/am"]);
    expect(s.state.launched).toBe(1);
    expect(s.viewports).toHaveLength(1);
  });

  it("renders the am and pm slots and no other directory under a day", async () => {
    const root = newRoot();
    cards(root, "2026-07-03", "am", 1);
    cards(root, "2026-07-03", "pm", 1);
    cards(root, "2026-07-03", "draft", 1);
    const s = stub();

    const { rendered } = await renderSlides(root, undefined, s.launch);

    expect(rendered).toEqual({ "2026-07-03/am": 1, "2026-07-03/pm": 1 });
  });

  it("renders only the requested day", async () => {
    const root = newRoot();
    cards(root, "2026-07-03", "am", 1);
    cards(root, "2026-07-04", "am", 2);
    const s = stub();

    expect(await renderSlides(root, "2026-07-04", s.launch)).toEqual({ rendered: { "2026-07-04/am": 2 } });
  });

  it("opens no browser for a requested day with no cards, or for nothing built", async () => {
    const root = newRoot();
    const s = stub();

    await expect(renderSlides(root, "2026-07-03", s.launch)).rejects.toThrow(
      "no cards for 2026-07-03; run npm run slides first",
    );
    expect(await renderSlides(root, undefined, s.launch)).toEqual({ rendered: {} });
    expect(s.state.launched).toBe(0);
  });

  it("closes the browser when a card fails to render", async () => {
    const root = newRoot();
    cards(root, "2026-07-03", "am", 2);
    const s = stub();
    s.page.screenshot = async () => {
      throw new Error("page crashed");
    };

    await expect(renderSlides(root, undefined, s.launch)).rejects.toThrow("page crashed");
    expect(s.state.closed).toBe(1);
  });
});
