import { expect, test } from "vitest";
import { decodeNumericRefs, htmlToText, stripTracking, truncate } from "../../src/pipeline/adapters/clean";

test("htmlToText strips tags and collapses whitespace", () => {
  expect(htmlToText("<p>Hello   <b>world</b></p>\n<p>x</p>")).toBe("Hello world x");
});

test("htmlToText decodes entities", () => {
  expect(htmlToText("a &amp; b &lt;c&gt;")).toBe("a & b <c>");
});

test("decodeNumericRefs decodes the spellings the-verge sends", () => {
  // The three in the 32-day archive, verbatim.
  expect(decodeNumericRefs("It looks like Apple&#8217;s iPhone 18")).toBe("It looks like Apple’s iPhone 18");
  expect(decodeNumericRefs("&#8216;quoted&#8217;")).toBe("‘quoted’");
  expect(decodeNumericRefs("AT&#038;T")).toBe("AT&T");
  expect(decodeNumericRefs("&#x2019;&#X2019;")).toBe("’’");
});

test("decodeNumericRefs decodes once and leaves everything else alone", () => {
  // One pass: a decoded & must not turn the text after it into a reference.
  expect(decodeNumericRefs("a&#38;#8217;b")).toBe("a&#8217;b");
  // Named entities are not its business; astral codepoints are.
  expect(decodeNumericRefs("&rsquo; &wibble; &# &#; 50% off")).toBe("&rsquo; &wibble; &# &#; 50% off");
  expect(decodeNumericRefs("&#128512;")).toBe("😀");
  // A tag-shaped title survives, which is why this is not htmlToText.
  expect(decodeNumericRefs("<<History>> of <geolocation>,")).toBe("<<History>> of <geolocation>,");
});

test("decodeNumericRefs leaves a reference no character answers to", () => {
  for (const s of ["&#0;", "&#55296;", "&#xD800;", "&#1114112;", "&#99999999;", "&#x1FFFFFF;"]) {
    expect(decodeNumericRefs(s)).toBe(s);
  }
});

test("truncate adds ellipsis past the limit", () => {
  expect(truncate("abcdef", 3)).toBe("abc…");
  expect(truncate("ab", 3)).toBe("ab");
});

test("stripTracking drops the tags a syndicator added", () => {
  expect(stripTracking("https://ex.com/a?utm_source=tldrnewsletter")).toBe("https://ex.com/a");
  expect(stripTracking("https://ex.com/a?utm_source=x&utm_medium=email&utm_campaign=y")).toBe("https://ex.com/a");
  expect(stripTracking("https://ex.com/a?smid=url-share")).toBe("https://ex.com/a");
  // Matched decoded: utm%5Fsource is utm_source to whoever reads the query.
  expect(stripTracking("https://ex.com/a?b=1&utm%5Fsource=x")).toBe("https://ex.com/a?b=1");
  // A stray % is not an encoding; the key stays as written and is kept.
  expect(stripTracking("https://ex.com/a?100%=1")).toBe("https://ex.com/a?100%=1");
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
