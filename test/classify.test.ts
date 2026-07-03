import { describe, expect, it } from "vitest";
import { isPromotional } from "../src/classify";

describe("isPromotional", () => {
  it("drops tagged and label-prefixed inventory", () => {
    expect(isPromotional({ title: "Ship faster with Acme (Sponsor)" })).toBe(true);
    expect(isPromotional({ title: "Sponsored: the future of infra" })).toBe(true);
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
