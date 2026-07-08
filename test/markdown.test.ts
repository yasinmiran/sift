import { describe, expect, it } from "vitest";
import { renderMarkdown } from "../src/site/markdown";

describe("pen marks", () => {
  it("renders scribbled underline and circle marks", () => {
    const html = renderMarkdown("a ==big deal== and ((circled)) here");
    expect(html).toContain('<mark class="pen pen-u">big deal</mark>');
    expect(html).toContain('<mark class="pen pen-o">circled</mark>');
  });

  it("parses inline markdown inside a mark", () => {
    expect(renderMarkdown("==**loud**==")).toContain(
      '<mark class="pen pen-u"><strong>loud</strong></mark>',
    );
  });

  it("leaves equals inside link urls alone", () => {
    const html = renderMarkdown("see [x](https://e.com/a?t=YWJjZA==) now");
    expect(html).toContain('href="https://e.com/a?t=YWJjZA=="');
    expect(html).not.toContain("pen-u");
  });

  it("leaves ordinary parens and stray equals alone", () => {
    const html = renderMarkdown("plain (text (nested)) and a == b");
    expect(html).not.toContain("<mark");
    expect(html).toContain("a == b");
  });
});
