import { expect, test } from "vitest";
import { htmlToText, stripTracking, truncate } from "../../src/pipeline/adapters/clean";

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

test("stripTracking drops the tags a syndicator added", () => {
  expect(stripTracking("https://ex.com/a?utm_source=tldrnewsletter")).toBe("https://ex.com/a");
  expect(stripTracking("https://ex.com/a?utm_source=x&utm_medium=email&utm_campaign=y")).toBe("https://ex.com/a");
  expect(stripTracking("https://ex.com/a?smid=url-share")).toBe("https://ex.com/a");
});

test("stripTracking keeps the query the article needs", () => {
  // The nyt link from 2026-09-09: the gift token is the only reason it opens.
  expect(stripTracking("https://ex.com/a?unlocked_article_code=1._lA&smid=bs-share&utm_source=tldrnewsletter")).toBe(
    "https://ex.com/a?unlocked_article_code=1._lA",
  );
  expect(stripTracking("https://youtube.com/watch?v=abc123")).toBe("https://youtube.com/watch?v=abc123");
  expect(stripTracking("https://ex.com/a?ref=console.dev")).toBe("https://ex.com/a?ref=console.dev");
});

test("stripTracking leaves an untagged url byte-identical", () => {
  for (const url of [
    "https://ex.com/a",
    "https://ex.com/a?",
    "https://ex.com/a?b=1#frag",
    "https://ex.com/#utm_x",
    // A ? after the # is fragment, not query: teslarati sends this shape.
    "https://ex.com/a/#google_vignette?utm_source=tldrnewsletter",
  ]) {
    expect(stripTracking(url)).toBe(url);
  }
});

test("stripTracking keeps the fragment when it drops the query", () => {
  expect(stripTracking("https://ex.com/a?utm_source=x#s2")).toBe("https://ex.com/a#s2");
  expect(stripTracking("https://ex.com/a?utm_source=x&b=1#s2")).toBe("https://ex.com/a?b=1#s2");
});
