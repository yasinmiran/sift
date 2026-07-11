import { describe, expect, it } from "vitest";
import { altText, buildCards, renderSheetHtml, renderSlideHtml, slideMeta, type CoverCard, type StoryCard } from "../src/slides/cards";
import type { SlidePost } from "../src/slides/data";

const POST: SlidePost = {
  slot: "am",
  hook: "OpenAI ships GPT-6 and the margin war begins",
  caption: "gpt-6 lands. full digest at sift.yasint.dev (link in bio)",
  hashtags: ["#tech", "#ai", "#devtools"],
  slides: [
    {
      number: 1,
      category: "ai / llms",
      title: "GPT-6 lands at $2/M tokens",
      desc: "a 5x cut with ==real margin pain== for rivals",
      url: "https://example.com/gpt6",
    },
    {
      number: 2,
      category: "security & privacy",
      title: "Chat Control returns",
      desc: "((mandatory scanning)) is back on the table",
      url: "https://www.heise.de/en/news/x",
    },
  ],
};

const DAY = "2026-07-11";

describe("buildCards", () => {
  const cards = buildCards(DAY, POST);

  it("wraps the post's slides in a cover and a cta", () => {
    expect(cards.map((c) => c.kind)).toEqual(["cover", "story", "story", "cta"]);
    expect(cards[0]).toEqual({ kind: "cover", day: DAY, slot: "am", hook: POST.hook });
    const story = cards[1] as StoryCard;
    expect(story.category).toBe("ai / llms");
    expect(story.title).toBe("GPT-6 lands at $2/M tokens");
    expect(story.desc).toBe("a 5x cut with ==real margin pain== for rivals");
  });

  it("defensively truncates a runaway title at a word boundary", () => {
    const long = buildCards(DAY, {
      ...POST,
      slides: [{ ...POST.slides[0]!, title: "very long headline words ".repeat(8).trim() }],
    })[1] as StoryCard;
    expect(long.title.length).toBeLessThanOrEqual(121);
    expect(long.title.endsWith("…")).toBe(true);
  });

  it("never leaves an unpaired pen marker after truncation", () => {
    const cut = buildCards(DAY, {
      ...POST,
      slides: [
        {
          ...POST.slides[0]!,
          desc: `short lead then ==a marked phrase that is definitely long enough to straddle the one hundred and ten character cap==`,
        },
      ],
    })[1] as StoryCard;
    expect(cut.desc).not.toContain("==");
  });
});

describe("altText", () => {
  const cards = buildCards(DAY, POST);

  it("describes each card kind in plain text, pen marks stripped, no source", () => {
    expect(altText(cards[0]!)).toBe("sift, Sat, Jul 11: OpenAI ships GPT-6 and the margin war begins");
    expect(altText(cards[1]!)).toBe("GPT-6 lands at $2/M tokens: a 5x cut with real margin pain for rivals");
    expect(altText(cards[3]!)).toBe("sift.yasint.dev: the day's tech, sifted twice daily");
  });

  it("caps alt text at instagram's 100 characters", () => {
    const long = buildCards(DAY, {
      ...POST,
      slides: [{ ...POST.slides[0]!, title: "word ".repeat(25).trim(), desc: "a why clause that adds length" }],
    })[1]!;
    const alt = altText(long);
    expect(alt.length).toBeLessThanOrEqual(100);
    expect(alt.endsWith("…")).toBe(true);
  });
});

describe("slideMeta", () => {
  const cards = buildCards(DAY, POST);

  it("pairs each png with its alt text and carries the post singletons", () => {
    const meta = slideMeta(DAY, POST, cards);
    expect(meta.day).toBe(DAY);
    expect(meta.slot).toBe("am");
    expect(meta.caption).toContain("link in bio");
    expect(meta.hashtags).toEqual(["#tech", "#ai", "#devtools"]);
    expect(meta.cards.map((c) => c.file)).toEqual([1, 2, 3, 4].map((n) => `card-${n}.png`));
    expect(meta.cards[1]!.alt).toContain("GPT-6");
  });
});

describe("renderSlideHtml", () => {
  const cards = buildCards(DAY, POST);

  it("renders a 1080x1350 card with the brand fonts and a counter", () => {
    const html = renderSlideHtml(cards[1]!, 1, cards.length);
    expect(html).toContain("width:1080px");
    expect(html).toContain("height:1350px");
    expect(html).toContain("Fraunces");
    expect(html).toContain("Karla");
    expect(html).toContain("2/4");
    expect(html).toContain("text-wrap:balance");
  });

  it("draws pen marks as hand-drawn strokes in titles and descs", () => {
    const marked = renderSlideHtml(cards[1]!, 1, cards.length);
    expect(marked).toContain('<span class="pen-u">real margin pain</span>');
    expect(marked).not.toContain("==real margin pain==");
    const circled = renderSlideHtml(cards[2]!, 2, cards.length);
    expect(circled).toContain('<span class="pen-o">mandatory scanning</span>');
    const titleMarked = renderSlideHtml(
      buildCards(DAY, { ...POST, slides: [{ ...POST.slides[0]!, title: "the ==$50,000== bounty" }] })[1]!,
      1,
      4,
    );
    expect(titleMarked).toContain('<span class="pen-u">$50,000</span>');
  });

  it("shows a human date on the cover and flags the evening post", () => {
    const cover = renderSlideHtml(cards[0]!, 0, cards.length);
    expect(cover).toContain("Sat, Jul 11");
    expect(cover).not.toContain("evening");
    const pm = renderSlideHtml(buildCards(DAY, { ...POST, slot: "pm" })[0]!, 0, 4);
    expect(pm).toContain("Sat, Jul 11 &middot; evening");
  });

  it("carries no source hostname on story cards", () => {
    const html = renderSlideHtml(cards[1]!, 1, cards.length);
    expect(html).not.toContain("example.com");
  });

  it("embeds the fonts so cards render offline with no fallback", () => {
    const html = renderSlideHtml(cards[0]!, 0, cards.length);
    expect(html.match(/data:font\/woff2;base64,/g)?.length).toBe(4);
    expect(html).toContain("Cormorant Garamond");
    expect(html).not.toContain("fonts.googleapis.com");
  });

  it("renders a scrollable preview sheet framing every card", () => {
    const html = renderSheetHtml("2026-07-11 am", 4);
    expect(html).toContain('src="card-1.html"');
    expect(html).toContain('src="card-4.html"');
    expect(html).toContain("2026-07-11 am");
    expect(html).toContain("scale(");
  });

  it("escapes html in agent-scripted text", () => {
    const cover: CoverCard = { kind: "cover", day: DAY, slot: "am", hook: "a <b>bold</b> claim" };
    const html = renderSlideHtml(cover, 0, 4);
    expect(html).not.toContain("<b>bold</b>");
    expect(html).toContain("&lt;b&gt;bold&lt;/b&gt;");
  });

  it("puts the handle and site on the cta card", () => {
    const html = renderSlideHtml(cards[3]!, 3, 4);
    expect(html).toContain("sift.yasint.dev");
    expect(html).toContain("@sifted.dev");
  });
});
