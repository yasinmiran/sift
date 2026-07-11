import { describe, expect, it } from "vitest";
import {
  altText,
  renderSheetHtml,
  renderSlideHtml,
  slideCards,
  slideMeta,
  type CoverCard,
  type StoryCard,
} from "../src/slides/cards";

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

  it("hooks the cover with the description's first clause, unpunctuated", () => {
    expect(cards[0]).toEqual({ kind: "cover", day: "2026-07-11", hook: "OpenAI ships GPT-6 and the margin war begins" });
    const long = slideCards({
      ...DIGEST,
      description: "Apple sues OpenAI over alleged systemic trade secret theft, the same day two other things happen.",
    })[0] as CoverCard;
    expect(long.hook).toBe("Apple sues OpenAI over alleged systemic trade secret theft");
    const short = slideCards({
      ...DIGEST,
      description: "JadePuffer, the first agent-run ransomware, lands.",
    })[0] as CoverCard;
    expect(short.hook).toBe("JadePuffer, the first agent-run ransomware");
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

  it("keeps only the first clause of the why text, markdown stripped, pen marks kept", () => {
    expect(stories[0]?.why).toBe("a 5x cut with ==real margin pain== for rivals");
    expect(stories[1]?.why).toBe("(one of yasin's picks today), gives each agent a pane.");
    expect(stories[2]?.why).toBe("with ((mandatory scanning)) on the table.");
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
    expect(story.why.length).toBeLessThanOrEqual(111);
    expect(story.why.endsWith("…")).toBe(true);
    expect(story.why).not.toMatch(/\s…$/);
  });

  it("prefers a comma boundary when truncating", () => {
    const why = `a complete leading thought that runs fairly long here, then a trailing clause that pushes the whole thing far over the cap and beyond`;
    const cards2 = slideCards({
      ...DIGEST,
      body: `## AI / LLMs\n\n- [Long one](https://e.com/a): ${why}\n`,
    });
    expect((cards2[1] as StoryCard).why).toBe("a complete leading thought that runs fairly long here…");
  });

  it("never leaves an unpaired pen marker after truncation", () => {
    const why = `short lead then ==a marked phrase that is definitely long enough to straddle the one hundred and ten character cap==`;
    const cards2 = slideCards({
      ...DIGEST,
      body: `## AI / LLMs\n\n- [Long one](https://e.com/a): ${why}\n`,
    });
    expect((cards2[1] as StoryCard).why).not.toContain("==");
  });

  it("caps a runaway headline", () => {
    const cards2 = slideCards({
      ...DIGEST,
      body: `## AI / LLMs\n\n- [${"very long headline words ".repeat(8).trim()}](https://e.com/a): short why.\n`,
    });
    const story = cards2[1] as StoryCard;
    expect(story.headline.length).toBeLessThanOrEqual(121);
    expect(story.headline.endsWith("…")).toBe(true);
  });
});

describe("altText", () => {
  const cards = slideCards(DIGEST);

  it("describes each card kind in plain text, pen marks stripped", () => {
    expect(altText(cards[0]!)).toBe("sift, Sat, Jul 11: OpenAI ships GPT-6 and the margin war begins");
    expect(altText(cards[1]!)).toBe("GPT-6 lands at $2/M tokens: a 5x cut with real margin pain for rivals (example.com)");
    expect(altText(cards[3]!)).toBe("Chat Control returns: with mandatory scanning on the table. (heise.de)");
    expect(altText(cards[5]!)).toBe("sift.yasint.dev: the day's tech, sifted twice daily");
  });

  it("caps alt text at instagram's 100 characters", () => {
    const long = slideCards({
      ...DIGEST,
      body: `## AI / LLMs\n\n- [${"word ".repeat(30).trim()}](https://e.com/a): a why clause that adds length.\n`,
    })[1]!;
    const alt = altText(long);
    expect(alt.length).toBeLessThanOrEqual(100);
    expect(alt.endsWith("…")).toBe(true);
  });
});

describe("slideMeta", () => {
  const cards = slideCards(DIGEST);

  it("pairs each png with its alt text and carries the caption", () => {
    const meta = slideMeta("2026-07-11", cards, {
      caption: "gpt-6 lands. full digest at sift.yasint.dev (link in bio)",
      hashtags: ["#tech", "#ai", "#devtools"],
    });
    expect(meta.day).toBe("2026-07-11");
    expect(meta.cards.map((c) => c.file)).toEqual([1, 2, 3, 4, 5, 6].map((n) => `card-${n}.png`));
    expect(meta.cards[1]!.alt).toContain("GPT-6");
    expect(meta.caption).toContain("link in bio");
    expect(meta.hashtags).toEqual(["#tech", "#ai", "#devtools"]);
  });

  it("degrades to a null caption when the day has no social file", () => {
    const meta = slideMeta("2026-07-11", cards, null);
    expect(meta.caption).toBeNull();
    expect(meta.hashtags).toEqual([]);
    expect(meta.cards).toHaveLength(6);
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
    expect(html).toContain("text-wrap:balance");
  });

  it("draws pen marks as hand-drawn strokes and shows a human date", () => {
    const story = renderSlideHtml(cards[1]!, 1, cards.length);
    expect(story).toContain('<span class="pen-u">real margin pain</span>');
    expect(story).not.toContain("==real margin pain==");
    const circled = renderSlideHtml(cards[3]!, 3, cards.length);
    expect(circled).toContain('<span class="pen-o">mandatory scanning</span>');
    const cover = renderSlideHtml(cards[0]!, 0, cards.length);
    expect(cover).toContain("Sat, Jul 11");
    expect(cover).not.toContain("2026-07-11</span>");
  });

  it("embeds the fonts so cards render offline with no fallback", () => {
    const html = renderSlideHtml(cards[0]!, 0, cards.length);
    expect(html.match(/data:font\/woff2;base64,/g)?.length).toBe(4);
    expect(html).toContain("Cormorant Garamond");
    expect(html).not.toContain("fonts.googleapis.com");
  });

  it("renders a scrollable preview sheet framing every card", () => {
    const html = renderSheetHtml("2026-07-11", 6);
    expect(html).toContain('src="card-1.html"');
    expect(html).toContain('src="card-6.html"');
    expect(html).toContain("2026-07-11");
    expect(html).toContain("scale(");
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
