import { expect, test } from "vitest";
import {
  authorName,
  decodeNumericRefs,
  htmlToText,
  stripTracking,
  truncate,
} from "../../src/pipeline/adapters/clean";

test("htmlToText strips tags and collapses whitespace", () => {
  expect(htmlToText("<p>Hello   <b>world</b></p>\n<p>x</p>")).toBe("Hello world x");
});

test("htmlToText decodes entities", () => {
  expect(htmlToText("a &amp; b &lt;c&gt;")).toBe("a & b <c>");
});

test("htmlToText drops the markup chrome a feed ships with its body", () => {
  // beehiiv's table stylesheet, the opening of every tl;dr sec issue in the
  // archive, verbatim down to the spacing.
  const beehiiv =
    "<style>.bh__table, .bh__table_header, .bh__table_cell { border: 1px solid #C0C0C0; }\n" +
    ".bh__table_cell { padding: 5px; background-color: #FFFFFF; }</style>";
  expect(htmlToText(`${beehiiv}<p>Hey there,</p>`)).toBe("Hey there,");
  expect(htmlToText("<p>Hello</p>\n<script>var a = 1</script>\n<p>World</p>")).toBe("Hello World");
  // Prose that talks about a stylesheet is still prose.
  expect(htmlToText("<p>Write .a{color:red} and see</p>")).toBe("Write .a{color:red} and see");
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

test("authorName takes the name out of an author element that has children", () => {
  // Both node shapes verbatim from the archive: blog.google, then nextjs.org.
  // The job title sitting next to the name is not a name and is dropped.
  expect(
    authorName({
      $: { "xmlns:author": "http://www.w3.org/2005/Atom" },
      name: ["Eileen Mannion"],
      title: ["VP, Marketing UKI and EMEA Devices and Services"],
      department: [""],
      company: [""],
    }),
  ).toBe("Eileen Mannion");
  expect(authorName({ name: ["Aurora Scharff"] })).toBe("Aurora Scharff");
  expect(authorName({ name: ["A One", "B Two"] })).toBe("A One, B Two");
});

test("authorName collapses the whitespace a pretty-printed creator carries", () => {
  // ars-technica's dc:creator, verbatim, then arxiv's two spellings.
  expect(authorName("\n                    Eric Berger\n                ")).toBe("Eric Berger");
  expect(authorName(" Elle")).toBe("Elle");
  expect(authorName("Rabimba Karanjai,  Yang Lu")).toBe("Rabimba Karanjai, Yang Lu");
  expect(authorName("Jakub Oleksy")).toBe("Jakub Oleksy");
});

test("authorName returns nothing when there is no name in there", () => {
  for (const empty of [undefined, null, "", "   \n ", 42, { $: { x: "1" } }, { name: [""] }, []]) {
    expect(authorName(empty)).toBeUndefined();
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
