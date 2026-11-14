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
      terms: [{ abbr: "Chat Control", gloss: "the EU proposal to scan private messages" }],
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
    expect(long.title.length).toBeLessThanOrEqual(120);
    expect(long.title.endsWith("…")).toBe(true);
    const unbroken = buildCards(DAY, {
      ...POST,
      slides: [{ ...POST.slides[0]!, title: "x".repeat(200) }],
    })[1] as StoryCard;
    expect(unbroken.title.length).toBeLessThanOrEqual(120);
    expect(unbroken.title.endsWith("…")).toBe(true);
  });

  it("keeps a marked title whole when its visible length fits the cap", () => {
    const marked = `==${"t".repeat(20)}== ${"u".repeat(97)}`;
    const card = buildCards(DAY, { ...POST, slides: [{ ...POST.slides[0]!, title: marked }] })[1] as StoryCard;
    expect(card.title).toBe(marked);
  });

  it("strips stray marks from the hook and caps runaway categories", () => {
    const cards = buildCards(DAY, {
      ...POST,
      hook: "a ==marked== hook",
      slides: [{ ...POST.slides[0]!, category: "a very long category label that wraps" }],
    });
    expect((cards[0] as CoverCard).hook).toBe("a marked hook");
    expect((cards[1] as StoryCard).category.length).toBeLessThanOrEqual(28);
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

  // A story alt hands over whole sentences or none, so every property below
  // about where a cut lands now lives on the cover, which composes
  // "sift, {day}: {hook}" and has nothing droppable to give back. The prefix's
  // own commas sit at 4 and 9, under truncate's 0.8 floor, so they are rejected
  // in all four and only the hook can reach the boundary on test.
  it("spends the budget rather than stopping at an early clause boundary", () => {
    const card = buildCards(DAY, {
      ...POST,
      hook: "The FAA grounded every departure in America for several hours on Friday night after a network update failed",
    })[0]!;
    expect(altText(card)).toBe(
      "sift, Sat, Jul 11: The FAA grounded every departure in America for several hours on Friday night\u2026",
    );
  });

  it("still ends on a clause when the comma is late enough to afford it", () => {
    const card = buildCards(DAY, {
      ...POST,
      hook: "Microsoft said email started coming back after almost two days of outage, with no cause named yet",
    })[0]!;
    expect(altText(card)).toBe(
      "sift, Sat, Jul 11: Microsoft said email started coming back after almost two days of outage\u2026",
    );
  });

  // The semicolon lands at 95 and the word boundary at 96, so the slice ends on
  // it and only trimTail can take it off: without the ";" in its class the alt
  // reads "invalid;\u2026".
  it("does not end a cut on the hook's own semicolon", () => {
    const card = buildCards(DAY, {
      ...POST,
      hook: "Most of the automated bug submissions sent to the project turned out invalid; nothing usable arrived",
    })[0]!;
    expect(altText(card)).toBe(
      "sift, Sat, Jul 11: Most of the automated bug submissions sent to the project turned out invalid\u2026",
    );
  });

  // The same arithmetic one character along, for the other half of trimTail's
  // class: a colon at 95, the word boundary at 96, "founder:\u2026" without it.
  it("does not end a cut on a colon inside the hook", () => {
    const card = buildCards(DAY, {
      ...POST,
      hook: "Nvidia named an interim chief after thirty-three years of one single founder: the board moved fast",
    })[0]!;
    expect(altText(card)).toBe(
      "sift, Sat, Jul 11: Nvidia named an interim chief after thirty-three years of one single founder\u2026",
    );
  });

  // 2026-11-14/am/card-3, published as written here. The title is 84 of the 100
  // characters and the desc is 72, so the old composition spent the remaining 14
  // on "A leaked plan\u2026" and threw the point away. 337 of the archive's 338
  // story alts read like that; the title alone is a whole sentence.
  it("drops the desc whole rather than handing over a fragment of it", () => {
    const card = buildCards(DAY, {
      ...POST,
      slides: [
        {
          ...POST.slides[0]!,
          title: "Amazon plans to catalog nearly every product sold online, even ones it does not sell",
          desc: "A leaked plan aims to make its index the one AI shopping agents rely on.",
        },
      ],
    })[1]!;
    expect(altText(card)).toBe(
      "Amazon plans to catalog nearly every product sold online, even ones it does not sell",
    );
  });

  // 2026-11-13/am/card-7, published as written here: 32 characters of room and a
  // first sentence of 17, so the budget buys a clause that closes.
  it("keeps as many of the desc's sentences as fit", () => {
    const card = buildCards(DAY, {
      ...POST,
      slides: [
        {
          ...POST.slides[0]!,
          title: "The FAA takes its AI rerouting advice nationwide after 180 flights",
          desc: "Airlines back it. The controllers' union says it was not involved in design or testing.",
        },
      ],
    })[1]!;
    expect(altText(card)).toBe(
      "The FAA takes its AI rerouting advice nationwide after 180 flights: Airlines back it.",
    );
  });

  // "As many as fit" is two sentences fitting, not one: with 39 characters of
  // room and stops at 9 and 34, taking the first fitting stop rather than the
  // last would publish "A record." and keep the point to itself.
  it("keeps every sentence that fits, not only the first", () => {
    const card = buildCards(DAY, {
      ...POST,
      slides: [
        {
          ...POST.slides[0]!,
          title: "Microsoft patched more than 1,400 flaws in one single batch",
          desc: "A record. The largest of the year.",
        },
      ],
    })[1]!;
    expect(altText(card)).toBe(
      "Microsoft patched more than 1,400 flaws in one single batch: A record. The largest of the year.",
    );
  });

  // The two edges of the room, one character apart on the same title, because
  // one case can only hold one of them down: 39 characters of room against a
  // desc of 39 and a desc of 40. Either edge off by one either overruns
  // instagram's budget or throws away a sentence that was paid for.
  it("keeps a desc that ends exactly on the budget", () => {
    const card = buildCards(DAY, {
      ...POST,
      slides: [
        {
          ...POST.slides[0]!,
          title: "Microsoft patched more than 1,400 flaws in one single batch",
          desc: "A record batch, the largest in the run.",
        },
      ],
    })[1]!;
    const alt = altText(card);
    expect(alt).toBe(
      "Microsoft patched more than 1,400 flaws in one single batch: A record batch, the largest in the run.",
    );
    expect(alt.length).toBe(100);
  });

  it("drops a desc that overruns the budget by one character", () => {
    const card = buildCards(DAY, {
      ...POST,
      slides: [
        {
          ...POST.slides[0]!,
          title: "Microsoft patched more than 1,400 flaws in one single batch",
          desc: "A record batch, the largest of the year.",
        },
      ],
    })[1]!;
    expect(altText(card)).toBe("Microsoft patched more than 1,400 flaws in one single batch");
  });

  // A period is a sentence end only when whitespace follows it, which is the
  // whole of the guard: the desc's only real stop is its last character, 50 of
  // the 36 characters on offer, so the desc goes. Reading "$1.4T" as a boundary
  // instead would fit and publish "\u2026inference chips: A $1.".
  it("does not take a period inside a number as a sentence end", () => {
    const card = buildCards(DAY, {
      ...POST,
      slides: [
        {
          ...POST.slides[0]!,
          title: "Fractile raises seven billion dollars to build inference chips",
          desc: "A $1.4T valuation, about 12% up on the last round.",
        },
      ],
    })[1]!;
    expect(altText(card)).toBe("Fractile raises seven billion dollars to build inference chips");
  });

  // The case that used to leave a cut sitting on altText's own joining colon
  // (an 88-character title, the word boundary falling on the space right after
  // the colon, the desc never arriving). A title that fills the budget is now
  // handed over as itself: no joiner, no ellipsis, nothing promised.
  it("hands over a budget-filling title with no joiner and no ellipsis", () => {
    const card = buildCards(DAY, {
      ...POST,
      slides: [
        {
          ...POST.slides[0]!,
          title: "Nvidia's board approached the Arm chief about succeeding Jensen Huang, sources say today",
          desc: "The approach was informal",
        },
      ],
    })[1]!;
    const alt = altText(card);
    expect(alt).toBe("Nvidia's board approached the Arm chief about succeeding Jensen Huang, sources say today");
    expect(alt.endsWith("\u2026")).toBe(false);
    expect(alt).not.toContain(": ");
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

  it("draws underlines as hand-drawn strokes and flattens stray circle marks", () => {
    const marked = renderSlideHtml(cards[1]!, 1, cards.length);
    expect(marked).toContain('<span class="pen-u">real margin pain</span>');
    expect(marked).not.toContain("==real margin pain==");
    const circled = renderSlideHtml(cards[2]!, 2, cards.length);
    expect(circled).toContain("mandatory scanning is back on the table");
    expect(circled).not.toContain("pen-o");
    expect(circled).not.toContain("((");
    const titleMarked = renderSlideHtml(
      buildCards(DAY, { ...POST, slides: [{ ...POST.slides[0]!, title: "the ==$50,000== bounty" }] })[1]!,
      1,
      4,
    );
    expect(titleMarked).toContain('<span class="pen-u">$50,000</span>');
  });

  it("shows a lowercased date on the cover and flags the evening post in amber", () => {
    const cover = renderSlideHtml(cards[0]!, 0, cards.length);
    expect(cover).toContain("Sat, Jul 11");
    expect(cover).toContain("text-transform:lowercase");
    expect(cover).not.toContain("evening");
    const pm = renderSlideHtml(buildCards(DAY, { ...POST, slot: "pm" })[0]!, 0, 4);
    expect(pm).toContain('<span class="dot">&middot; evening</span>');
  });

  it("hands a line's own full stop to the accent dot rather than printing both", () => {
    const stopped: CoverCard = { kind: "cover", day: DAY, slot: "am", hook: "Trump just called that fear a hoax." };
    const html = renderSlideHtml(stopped, 0, 4);
    expect(html).toContain('a hoax<span class="dot">.</span></p>');
    expect(html).not.toContain("a hoax.<span");
    const title = renderSlideHtml(
      buildCards(DAY, { ...POST, slides: [{ ...POST.slides[0]!, title: "GPT-6 lands at $2/M tokens." }] })[1]!,
      1,
      4,
    );
    expect(title).toContain('$2/M tokens<span class="dot">.</span></h1>');
    expect(title).not.toContain("tokens.<span");
  });

  it("reads the stop under a trailing pen mark, not the marker", () => {
    const marked = renderSlideHtml(
      buildCards(DAY, { ...POST, slides: [{ ...POST.slides[0]!, title: "the ==$2/M price war.==" }] })[1]!,
      1,
      4,
    );
    expect(marked).toContain('<span class="pen-u">$2/M price war</span><span class="dot">.</span></h1>');
    expect(marked).not.toContain("price war.</span>");
    const asked = renderSlideHtml(
      buildCards(DAY, { ...POST, slides: [{ ...POST.slides[0]!, title: "who pays for ==the compute?==" }] })[1]!,
      1,
      4,
    );
    expect(asked).toContain('<span class="pen-u">the compute?</span></h1>');
  });

  it("leaves a line that stops on its own mark alone, and still closes an open one", () => {
    const asking: CoverCard = { kind: "cover", day: DAY, slot: "am", hook: "who is paying for the compute?" };
    const question = renderSlideHtml(asking, 0, 4);
    expect(question).toContain("the compute?</p>");
    expect(question).not.toContain("compute?<span");
    const runaway = buildCards(DAY, {
      ...POST,
      slides: [{ ...POST.slides[0]!, title: "very long headline words ".repeat(8).trim() }],
    })[1]!;
    expect(renderSlideHtml(runaway, 1, 4)).toContain("…</h1>");
    expect(renderSlideHtml(cards[0]!, 0, cards.length)).toContain('margin war begins<span class="dot">.</span></p>');
    expect(renderSlideHtml(cards[1]!, 1, cards.length)).toContain('$2/M tokens<span class="dot">.</span></h1>');
  });

  it("sizes a title by its visible text, so a pen mark cannot shrink it a step", () => {
    const size = (title: string): string => {
      const html = renderSlideHtml(buildCards(DAY, { ...POST, slides: [{ ...POST.slides[0]!, title }] })[1]!, 1, 4);
      return /font-size:(\d+)px;line-height:1\.2;/.exec(html)![1]!;
    };
    // 62 characters of source, 58 of ink: 2026-09-24 pm published this one a
    // size down, and the same line without the markers never did.
    expect(size("OpenAI sat on an Australian government hack for ==five weeks==")).toBe("78");
    expect(size("OpenAI sat on an Australian government hack for five weeks")).toBe("78");
    // The other breakpoint, 101 against 97.
    expect(
      size("OpenAI sat on an Australian government hack for ==five weeks== and told nobody until the audit landed"),
    ).toBe("68");
    // A title that is genuinely long still steps down, marks or not (64 of ink).
    expect(size("OpenAI sat on an Australian government hack for ==five whole weeks==")).toBe("68");
  });

  it("carries no source hostname on story cards", () => {
    const html = renderSlideHtml(cards[1]!, 1, cards.length);
    expect(html).not.toContain("example.com");
  });

  it("renders term footnotes with a mono abbr and a karla gloss, only when a slide has them", () => {
    const withTerms = renderSlideHtml(cards[2]!, 2, cards.length);
    expect(withTerms).toContain(
      '<p><span class="abbr">Chat Control</span> &middot; the EU proposal to scan private messages</p>',
    );
    expect(withTerms).toContain('class="terms"');
    const without = renderSlideHtml(cards[1]!, 1, cards.length);
    expect(without).not.toContain('class="terms"');
  });

  it("embeds the fonts so cards render offline with no fallback", () => {
    const html = renderSlideHtml(cards[0]!, 0, cards.length);
    expect(html.match(/data:font\/woff2;base64,/g)?.length).toBe(4);
    expect(html).toContain("Cormorant Garamond");
    expect(html).not.toContain("fonts.googleapis.com");
  });

  // The sheet is the last look before the sidecar posts, so it frames the
  // rendered pngs rather than the card html they came from: what is on the
  // sheet is what goes out, and the card html never has to leave the build
  // tree. Alt text comes from the same meta the sidecar posts with.
  it("renders a preview sheet framing every card's png", () => {
    const html = renderSheetHtml("2026-07-11 am", slideMeta(DAY, POST, cards).cards);
    expect(html).toContain('src="card-1.png"');
    expect(html).toContain(`src="card-${cards.length}.png"`);
    expect(html).not.toContain(".html");
    expect(html).toContain('alt="sift, Sat, Jul 11:');
    expect(html).toContain("2026-07-11 am");
  });

  it("escapes html in agent-scripted text", () => {
    const cover: CoverCard = { kind: "cover", day: DAY, slot: "am", hook: "a <b>bold</b> claim" };
    const html = renderSlideHtml(cover, 0, 4);
    expect(html).not.toContain("<b>bold</b>");
    expect(html).toContain("&lt;b&gt;bold&lt;/b&gt;");
  });

  // The sheet is served from sift.yasint.dev beside the day pages and has to
  // say it is not one; the cards keep the directive too, since a card html is
  // a document wherever it sits. Asserted inside <head>, and over every card
  // kind: the body is chosen per kind, which is where it could get lost.
  it("tells crawlers the cards and the sheet are not pages", () => {
    const head = (html: string) => {
      const end = html.indexOf("</head>");
      expect(end).toBeGreaterThan(0);
      return html.slice(0, end);
    };
    expect(new Set(cards.map((c) => c.kind))).toEqual(new Set(["cover", "story", "cta"]));
    for (const [i, card] of cards.entries()) {
      expect(head(renderSlideHtml(card, i, cards.length))).toContain(
        '<meta name="robots" content="noindex">',
      );
    }
    expect(head(renderSheetHtml("2026-07-11 am", slideMeta(DAY, POST, cards).cards))).toContain(
      '<meta name="robots" content="noindex">',
    );
  });

  it("puts the handle and site on the cta card", () => {
    const html = renderSlideHtml(cards[3]!, 3, 4);
    expect(html).toContain("sift.yasint.dev");
    expect(html).toContain("@sifted.dev");
  });
});
