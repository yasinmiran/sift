import { describe, expect, it } from "vitest";
import { isPaywalled } from "../src/pipeline/paywall";

describe("isPaywalled", () => {
  it("flags hard-paywall domains including subdomains", () => {
    expect(isPaywalled({ url: "https://www.wsj.com/tech/some-story" })).toBe(true);
    expect(isPaywalled({ url: "https://theinformation.com/articles/x" })).toBe(true);
    expect(isPaywalled({ url: "https://example.com/wsj.com-analysis" })).toBe(false);
  });

  it("flags subscriber-only stubs in the body regardless of domain", () => {
    expect(
      isPaywalled({ url: "https://blog.example.com/post", content: "This post is for paid subscribers" }),
    ).toBe(true);
    expect(isPaywalled({ url: "https://blog.example.com/post", content: "full text here" })).toBe(false);
  });
});

describe("gift links", () => {
  // The three shapes in the rolling month's items, verbatim but for the token.
  it("does not flag a link the publisher unlocked", () => {
    expect(
      isPaywalled({
        url: "https://www.nytimes.com/2026/09/08/us/politics/calif-ai-worm-wechat-hack.html?unlocked_article_code=1._lA.Krp-.CpJAS216xN4U",
      }),
    ).toBe(false);
    expect(
      isPaywalled({ url: "https://www.bloomberg.com/news/articles/2026-09-03/x?accessToken=eyJhbGciOiJIUzI1NiJ9.e30" }),
    ).toBe(false);
    expect(
      isPaywalled({
        url: "https://www.ft.com/content/1178d641?sharetype=gift&token=1178d641-a340-4962-89e1-0d1c3e9f0a11",
      }),
    ).toBe(false);
  });

  it("still flags a share link that is not a gift", () => {
    // wsj's share permalink lands on the same wall, so it is not an unlock.
    expect(
      isPaywalled({ url: "https://www.wsj.com/tech/ai/story-9f2?st=Y1r31t&reflink=desktopwebshare_permalink" }),
    ).toBe(true);
    // A named token with no value is no token.
    expect(isPaywalled({ url: "https://www.nytimes.com/2026/09/08/x.html?unlocked_article_code=" })).toBe(true);
    expect(isPaywalled({ url: "https://www.ft.com/content/abc?sharetype=blocked" })).toBe(true);
  });

  it("still flags an unlocked url whose body is a subscriber stub", () => {
    // The body is evidence about this item; the domain is only a guess, and
    // only the guess is what a gift token overrides.
    expect(
      isPaywalled({
        url: "https://www.bloomberg.com/news/articles/2026-09-03/x?accessToken=eyJhbGciOiJIUzI1NiJ9.e30",
        content: "Subscribe to keep reading",
      }),
    ).toBe(true);
  });
});
