import { describe, expect, it } from "vitest";
import { truncate } from "../src/pipeline/adapters/clean";
import { isPromotional } from "../src/pipeline/promo";

describe("isPromotional", () => {
  it("drops tagged and label-prefixed inventory", () => {
    expect(isPromotional({ title: "Ship faster with Acme (Sponsor)" })).toBe(true);
    expect(isPromotional({ title: "Sponsored: the future of infra" })).toBe(true);
    expect(isPromotional({ title: "Sponsor - ship faster with Acme" })).toBe(true);
    expect(isPromotional({ title: "Clean headline", content: "[Sponsored]\nbody" })).toBe(true);
  });

  it("drops links carrying paid utm signals", () => {
    expect(
      isPromotional({
        title: "They matched 2,000+ companies with top talent",
        url: "https://ads.example.com/lp?utm_source=tldr&utm_content=cta_hiring",
      }),
    ).toBe(true);
    expect(
      isPromotional({ title: "A tool", url: "https://x.example/?utm_medium=sponsored" }),
    ).toBe(true);
    expect(
      isPromotional({ title: "A tool", url: "https://x.example/?utm_campaign=q3_sponsor_push" }),
    ).toBe(true);
  });

  it("scans only the body's opening, not sponsor tags deep in a full-text post", () => {
    const deepTag = `${"Editorial analysis of the week. ".repeat(200)}(Sponsor) listen to the podcast`;
    expect(isPromotional({ title: "Clean headline", content: deepTag })).toBe(false);
    const openingTag = `Together with Acme (Sponsor). ${"body ".repeat(500)}`;
    expect(isPromotional({ title: "Clean headline", content: openingTag })).toBe(true);
  });

  it("drops a badge label the item's own headline follows", () => {
    // tldr renders the slot label in its own element, so htmlToText fuses it
    // onto the headline with no punctuation for the two tags above to find.
    expect(
      isPromotional({
        title: "How a Robot Goes from Demo to Every Shift",
        content:
          "Sponsor How a Robot Goes from Demo to Every Shift tldr.tech/blog Robot demos are everywhere, but few robots work every shift.",
      }),
    ).toBe(true);
    // The headline is what makes the bare word a label, so the cap the tag
    // scan above needs must not reach it: the badge is anchored at character
    // zero, and a headline can run past 200 characters.
    const longTitle = `Why ${"the static docs rebuild ".repeat(9)}mattered`;
    expect(longTitle.length).toBeGreaterThan(200);
    expect(
      isPromotional({ title: longTitle, content: `Sponsor ${longTitle} example.com body` }),
    ).toBe(true);
    // And past 200 the stored headline is truncate()'s, ellipsis and all.
    expect(
      isPromotional({
        title: truncate(longTitle, 200),
        content: `Sponsor ${longTitle} example.com body`,
      }),
    ).toBe(true);
  });

  it("keeps prose that opens on a label word its headline does not follow", () => {
    expect(
      isPromotional({
        title: "The quiet career ladder",
        content: "Promoted to staff engineer at 26, and what the title actually bought.",
      }),
    ).toBe(false);
    // A badge past the first character is a word in a sentence.
    expect(
      isPromotional({ title: "Ad tech, continued", content: "A note on Sponsor Ad tech, continued" }),
    ).toBe(false);
    // An absent headline follows nothing, so the bare word decides nothing.
    expect(isPromotional({ title: "", content: "Sponsor roundup of the week" })).toBe(false);
  });

  it("keeps editorial content, editorial tracking params and ad-adjacent prose", () => {
    expect(isPromotional({ title: "How we built an ad server" })).toBe(false);
    expect(isPromotional({ title: "Paid search economics, explained" })).toBe(false);
    expect(
      isPromotional({
        title: "Big model release",
        url: "https://example.com/story?utm_source=tldrnewsletter&utm_medium=newsletter",
      }),
    ).toBe(false);
    expect(isPromotional({ title: "A story", url: "not a url" })).toBe(false);
  });
});
