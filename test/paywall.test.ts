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
