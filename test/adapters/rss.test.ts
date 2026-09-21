import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { createRssAdapter } from "../../src/pipeline/adapters/rss";

const xml = (p: string) => readFileSync(join(__dirname, "../fixtures/rss", p), "utf8");

const parse = (slug: string, fixture: string, since = new Date(0)) => {
  const a = createRssAdapter({ slug, url: "https://x" });
  if (a.mode !== "body") throw new Error("rss adapter must be body-mode");
  return a.parse(xml(fixture), since);
};

test("maps RSS 2.0 entries, strips html, sets a stable externalId", async () => {
  const items = await parse("lobsters", "lobsters.xml");
  expect(items.length).toBeGreaterThan(0);
  expect(items.every((i) => !i.content.includes("<"))).toBe(true);
  expect(items.every((i) => i.externalId.length > 0 && i.title.length > 0)).toBe(true);
  expect(items.every((i) => i.sourceSlug === "lobsters")).toBe(true);
  expect(items.every((i) => i.mediaType === "text")).toBe(true);
});

test("maps Atom entries with a link/id fallback for externalId", async () => {
  const items = await parse("sw", "simonwillison.xml");
  expect(items.length).toBeGreaterThan(0);
  expect(items.every((i) => i.externalId.length > 0)).toBe(true);
});

test("reads an atom body out of summary when the feed sends no content", async () => {
  // simonwillison.net ships <summary type="html"> and no <content>, so every
  // one of its 90 archived items stored an empty string. The fixture is that
  // feed: 30 entries, 30 summaries, no content element between them.
  const items = await parse("simon-willison", "simonwillison.xml");
  expect(items).toHaveLength(30);
  expect(items.every((i) => i.content.length > 0)).toBe(true);
  expect(items[0]!.content).toContain("Frontier models are trained at an enormous cost");
  // The summary is escaped html, so the tags have to be gone -- but not every
  // angle bracket with them: this author quotes markup, and "<iframe>" inside
  // a sentence is prose the digest agent should still get.
  expect(items[0]!.content).not.toContain("<blockquote");
  expect(items[0]!.content).not.toContain("<p>");
  expect(items.some((i) => i.content.includes("<iframe>"))).toBe(true);
});

test("prefers a real body over the summary when a feed carries both", async () => {
  const feed = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>t</title>
    <entry><title>t</title><id>e1</id><link href="https://example.com/1" rel="alternate"/>
    <published>${new Date().toISOString()}</published>
    <summary type="html">the teaser</summary>
    <content type="html">the whole post</content></entry>
  </feed>`;
  const a = createRssAdapter({ slug: "both", url: "https://x" });
  if (a.mode !== "body") throw new Error("rss adapter must be body-mode");
  const items = await a.parse(feed, new Date(0));
  expect(items[0]!.content).toBe("the whole post");
});

test("filters entries published before since", async () => {
  const future = await parse("lobsters", "lobsters.xml", new Date("2099-01-01"));
  expect(future).toHaveLength(0);
});

test("drops an entry whose pubDate is unparseable instead of emitting an Invalid Date", async () => {
  const items = await parse("bad", "bad-date.xml");
  expect(items.every((i) => !Number.isNaN(i.publishedAt.getTime()))).toBe(true);
  expect(items.map((i) => i.externalId)).toEqual(["https://example.com/good"]);
});

test("stamps mediaType video when configured", async () => {
  const a = createRssAdapter({ slug: "fireship", url: "https://x", mediaType: "video" });
  if (a.mode !== "body") throw new Error("rss adapter must be body-mode");
  const items = await a.parse(xml("lobsters.xml"), new Date(0));
  expect(items.length).toBeGreaterThan(0);
  expect(items.every((i) => i.mediaType === "video")).toBe(true);
});

test("strips zero-width watermark characters from titles and content", async () => {
  const feed = `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title>
    <item><title>Zero​width‌ title﻿</title><guid>e1</guid>
    <link>https://example.com/1</link><pubDate>${new Date().toUTCString()}</pubDate>
    <description>body​text</description></item>
  </channel></rss>`;
  const a = createRssAdapter({ slug: "stackoverflow-blog", url: "https://x" });
  if (a.mode !== "body") throw new Error("rss adapter must be body-mode");
  const items = await a.parse(feed, new Date(0));
  expect(items[0]!.title).toBe("Zerowidth title");
  expect(items[0]!.content).toBe("bodytext");
});

const cdataFeed = (body: string) =>
  `<?xml version="1.0"?><rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><title>t</title>
    <item><title>t</title><guid>e1</guid>
    <link>https://example.com/1</link><pubDate>${new Date().toUTCString()}</pubDate>
    ${body}</item>
  </channel></rss>`;

const parseFeed = async (slug: string, feed: string) => {
  const a = createRssAdapter({ slug, url: "https://x" });
  if (a.mode !== "body") throw new Error("rss adapter must be body-mode");
  return a.parse(feed, new Date(0));
};

test("leaves entities inside CDATA alone so the html parser can decode them", async () => {
  const encoded = await parseFeed(
    "the-verge",
    cdataFeed(
      `<content:encoded><![CDATA[<p>Klarna CFO Niclas Negl&eacute;n and Michael Nu&ntilde;ez</p>]]></content:encoded>`,
    ),
  );
  expect(encoded[0]!.content).toBe("Klarna CFO Niclas Neglén and Michael Nuñez");

  const described = await parseFeed(
    "techmeme",
    cdataFeed(`<description><![CDATA[Pinewood agrees to a &pound;545M cash takeover]]></description>`),
  );
  expect(described[0]!.content).toBe("Pinewood agrees to a £545M cash takeover");
});

test("keeps a newsletter's stylesheet out of the summary", async () => {
  // beehiiv ships its table styles inside content:encoded, so all four tl;dr
  // sec issues in the 32-day archive store the same 460 characters of css
  // ahead of the newsletter's first word.
  const items = await parseFeed(
    "tldrsec",
    cdataFeed(
      `<content:encoded><![CDATA[<style>.bh__table, .bh__table_header, .bh__table_cell { border: 1px solid #C0C0C0; }
        .bh__table_cell p { color: #2D2D2D; font-family: 'Helvetica',Arial,sans-serif !important; }</style>
        <p>Hey there,</p><p>I hope you&rsquo;ve been doing well!</p>]]></content:encoded>`,
    ),
  );
  expect(items[0]!.content).toBe("Hey there,I hope you’ve been doing well!");
});

test("still sanitizes the markup on both sides of a CDATA section", async () => {
  const feed = `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title>
    <item><title>what&rsquo;s new &wibble;</title><guid>e1</guid>
    <link>https://example.com/1</link><pubDate>${new Date().toUTCString()}</pubDate>
    <description><![CDATA[a &pound;5 note]]></description>
    <category>security&nbsp;news</category></item>
  </channel></rss>`;
  const items = await parseFeed("mixed", feed);
  expect(items).toHaveLength(1);
  expect(items[0]!.title).toBe("what’s new &wibble;");
  expect(items[0]!.content).toBe("a £5 note");
});

test("decodes a numeric reference the parser handed on as literal title text", async () => {
  // the-verge's titles are CDATA-wrapped, where &#8217; is text rather than a
  // reference, so the parser cannot decode it and content's cheerio pass
  // never sees a title. 49 titles in the 32-day archive are spelled this way.
  const cdata = await parseFeed(
    "the-verge",
    `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title>
      <item><title><![CDATA[It looks like Apple&#8217;s iPhone 18 &#038; the Pixel]]></title>
      <guid>e1</guid><link>https://example.com/1</link>
      <pubDate>${new Date().toUTCString()}</pubDate><description>d</description></item>
    </channel></rss>`,
  );
  expect(cdata[0]!.title).toBe("It looks like Apple’s iPhone 18 & the Pixel");

  // The double-encoded spelling reaches the title the same way.
  const doubled = await parseFeed(
    "the-verge",
    `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title>
      <item><title>Apple&amp;#8217;s iPhone</title>
      <guid>e1</guid><link>https://example.com/1</link>
      <pubDate>${new Date().toUTCString()}</pubDate><description>d</description></item>
    </channel></rss>`,
  );
  expect(doubled[0]!.title).toBe("Apple’s iPhone");
});

test("decodes before stripping, so a watermark written as a reference still goes", async () => {
  const items = await parseFeed(
    "stackoverflow-blog",
    `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title>
      <item><title><![CDATA[Zero&#8203;width&#65279; title]]></title>
      <guid>e1</guid><link>https://example.com/1</link>
      <pubDate>${new Date().toUTCString()}</pubDate><description>d</description></item>
    </channel></rss>`,
  );
  expect(items[0]!.title).toBe("Zerowidth title");
});

test("does not mistake a CDATA marker written inside a comment for a real one", async () => {
  const feed = `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title>
    <!-- the old exporter wrapped these in <![CDATA[ -->
    <item><title>security news &wibble;</title><guid>e1</guid>
    <link>https://example.com/1</link><pubDate>${new Date().toUTCString()}</pubDate>
    <description><![CDATA[a &pound;5 note]]></description></item>
  </channel></rss>`;
  const items = await parseFeed("commented", feed);
  expect(items[0]!.title).toBe("security news &wibble;");
  expect(items[0]!.content).toBe("a £5 note");
});

test("tolerates html-named entities that are not valid xml", async () => {
  const feed = `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title>
    <item><title>Security&nbsp;news: what&rsquo;s new &wibble;</title><guid>e1</guid>
    <link>https://example.com/1</link><pubDate>${new Date().toUTCString()}</pubDate>
    <description>body&hellip;</description></item>
  </channel></rss>`;
  const a = createRssAdapter({ slug: "tldrsec", url: "https://x" });
  if (a.mode !== "body") throw new Error("rss adapter must be body-mode");
  const items = await a.parse(feed, new Date(0));
  expect(items).toHaveLength(1);
  expect(items[0]!.title).toContain("Security news: what’s new");
  expect(items[0]!.content).toContain("body…");
});

test("normalizes an author element that carries child elements, not text", async () => {
  // blog.google's item, verbatim: in rss 2.0 an <author> with children parses
  // to the parser's node for the whole element, so the name has to be read
  // out of it. ars-technica's dc:creator is the same field pretty-printed.
  const feed = `<?xml version="1.0"?><rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel><title>t</title>
    <item><title>Get closer to the game with Gemini and Pixel</title><guid>e1</guid>
    <link>https://blog.google/1</link><pubDate>${new Date().toUTCString()}</pubDate>
    <author xmlns:author="http://www.w3.org/2005/Atom"><name>Eileen Mannion</name><title>VP, Marketing UKI and EMEA Devices and Services</title><department></department><company></company></author>
    <description>body</description></item>
    <item><title>Rocket Report</title><guid>e2</guid>
    <link>https://arstechnica.com/1</link><pubDate>${new Date().toUTCString()}</pubDate>
    <dc:creator>
                    Eric Berger
                </dc:creator>
    <description>body</description></item>
    <item><title>No byline here</title><guid>e3</guid>
    <link>https://example.com/3</link><pubDate>${new Date().toUTCString()}</pubDate>
    <author><name></name></author><description>body</description></item>
  </channel></rss>`;
  const items = await parseFeed("google-ai-blog", feed);
  expect(items.map((i) => i.author)).toEqual(["Eileen Mannion", "Eric Berger", undefined]);
  // The job title inside that node never becomes the item's own.
  expect(items[0]!.title).toBe("Get closer to the game with Gemini and Pixel");
});
