import { describe, expect, it } from "vitest";
import { renderSlideHtml, slideCards, type StoryCard } from "../src/slides/cards";

const DIGEST = {
  day: "2026-07-11",
  title: "The day's tech, sifted: Jul 11, 2026",
  description: "OpenAI ships GPT-6 and the margin war begins.",
  body: `**What matters today:** lead paragraph.

## AI / LLMs

- [GPT-6 lands at $2/M tokens](https://example.com/gpt6?a=b): a 5x cut with ==real margin pain== for rivals; separately, this second clause never reaches the card.
- [Second story](https://example.com/two) never reaches a card.

## Devtools & Infra

- [Herdr multiplexes agents](https://github.com/x/herdr) (one of yasin's picks today), gives each agent a pane.

## Empty Section

## Security & Privacy

- [Chat Control returns](https://www.heise.de/en/news/x) with ((mandatory scanning)) on the table.

## Startups & Industry

- [Meta faces $1.4T penalties](https://www.techmeme.com/1#a1): four states want it all.

## Research

- [Fifth section entry](https://example.com/r5) stays off the carousel.

## Hacker News

Front page prose with [links](https://example.com/hn).

## Threads

- connective tissue only.
`,
};

describe("slideCards", () => {
  const cards = slideCards(DIGEST);
  const stories = cards.filter((c) => c.kind === "story") as StoryCard[];

  it("builds cover, four stories and a cta in order", () => {
    expect(cards.map((c) => c.kind)).toEqual(["cover", "story", "story", "story", "story", "cta"]);
  });

  it("carries the description verbatim as the cover hook", () => {
    expect(cards[0]).toEqual({ kind: "cover", day: "2026-07-11", hook: DIGEST.description });
  });

  it("takes the first entry of the first four non-empty sections", () => {
    expect(stories.map((s) => s.section)).toEqual([
      "AI / LLMs",
      "Devtools & Infra",
      "Security & Privacy",
      "Startups & Industry",
    ]);
    expect(stories[0]?.headline).toBe("GPT-6 lands at $2/M tokens");
    expect(stories[3]?.headline).toBe("Meta faces $1.4T penalties");
  });

  it("keeps only the first clause of the why text, marks and markdown stripped", () => {
    expect(stories[0]?.why).toBe("a 5x cut with real margin pain for rivals");
    expect(stories[1]?.why).toBe("(one of yasin's picks today), gives each agent a pane.");
    expect(stories[2]?.why).toBe("with mandatory scanning on the table.");
  });

  it("derives the source from the url hostname without www", () => {
    expect(stories.map((s) => s.source)).toEqual(["example.com", "github.com", "heise.de", "techmeme.com"]);
  });

  it("never uses hacker news, threads or a fifth section", () => {
    const text = JSON.stringify(cards);
    expect(text).not.toContain("Hacker News");
    expect(text).not.toContain("Threads");
    expect(text).not.toContain("Fifth section");
  });

  it("truncates a long why clause at a word boundary with an ellipsis", () => {
    const why = `starts here ${"word ".repeat(60)}ends`;
    const cards2 = slideCards({
      ...DIGEST,
      body: `## AI / LLMs\n\n- [Long one](https://e.com/a): ${why}\n`,
    });
    const story = cards2[1] as StoryCard;
    expect(story.why.length).toBeLessThanOrEqual(141);
    expect(story.why.endsWith("…")).toBe(true);
    expect(story.why).not.toMatch(/\s…$/);
  });
});

describe("renderSlideHtml", () => {
  const cards = slideCards(DIGEST);

  it("renders a 1080x1350 card with the brand fonts and a counter", () => {
    const html = renderSlideHtml(cards[1]!, 1, cards.length);
    expect(html).toContain("width:1080px");
    expect(html).toContain("height:1350px");
    expect(html).toContain("Fraunces");
    expect(html).toContain("Karla");
    expect(html).toContain("2/6");
  });

  it("escapes html in digest-derived text", () => {
    const html = renderSlideHtml({ kind: "cover", day: "2026-07-11", hook: "a <b>bold</b> claim" }, 0, 6);
    expect(html).not.toContain("<b>bold</b>");
    expect(html).toContain("&lt;b&gt;bold&lt;/b&gt;");
  });

  it("puts the handle and site on the cta card", () => {
    const html = renderSlideHtml(cards[5]!, 5, 6);
    expect(html).toContain("sift.yasint.dev");
    expect(html).toContain("@sifted.dev");
  });
});
