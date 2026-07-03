import { expect, test } from "vitest";
import { htmlToText, truncate } from "../../src/adapters/clean";

test("htmlToText strips tags and collapses whitespace", () => {
  expect(htmlToText("<p>Hello   <b>world</b></p>\n<p>x</p>")).toBe("Hello world x");
});

test("htmlToText decodes entities", () => {
  expect(htmlToText("a &amp; b &lt;c&gt;")).toBe("a & b <c>");
});

test("truncate adds ellipsis past the limit", () => {
  expect(truncate("abcdef", 3)).toBe("abc…");
  expect(truncate("ab", 3)).toBe("ab");
});
