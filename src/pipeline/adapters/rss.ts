import Parser from "rss-parser";
import { info } from "../../log";
import { authorName, decodeNumericRefs, htmlToText, stripInvisibles } from "./clean";
import type { Adapter, RawItem } from "./types";

type ParsedFeed = Awaited<ReturnType<Parser["parseString"]>>;
type FeedItem = ParsedFeed["items"][number] & {
  "content:encoded"?: string;
  creator?: string;
  id?: string;
  // Atom's fourth place to put a body. rss-parser maps <content> to content
  // and <summary> to this, and a feed is free to ship either, both or one
  // as the other's teaser.
  summary?: string;
  // rss-parser declares no author, so this one arrives through the output's
  // index signature and is whatever the xml parser built for the element.
  author?: unknown;
};

const parser = new Parser();

// XML only defines five named entities; feeds routinely leak html ones. The
// parse dies on an entity the parser does not know (&wibble;), so the
// load-bearing half here is the fallback that neutralizes those. The map is
// belt and braces: rss-parser 3.13.0 resolves every name in it natively —
// probed, along with &eacute;, &pound; and a dozen more — so it only earns
// its place if a future parser stops doing that.
const XML_NATIVE = new Set(["amp", "lt", "gt", "quot", "apos"]);
const HTML_ENTITIES: Record<string, string> = {
  nbsp: "&#160;",
  mdash: "&#8212;",
  ndash: "&#8211;",
  lsquo: "&#8216;",
  rsquo: "&#8217;",
  ldquo: "&#8220;",
  rdquo: "&#8221;",
  hellip: "&#8230;",
  bull: "&#8226;",
  middot: "&#183;",
  copy: "&#169;",
  reg: "&#174;",
  trade: "&#8482;",
};

function sanitizeMarkup(xml: string): string {
  return xml.replace(/&([a-zA-Z][a-zA-Z0-9]{1,31});/g, (whole, name: string) =>
    XML_NATIVE.has(name) ? whole : (HTML_ENTITIES[name] ?? `&amp;${name};`),
  );
}

// CDATA is the one place this must not reach. An & in there is already
// literal text, so nothing inside can break the parse — and neutralizing it
// anyway adds an &amp; the parser hands on verbatim, which leaves techmeme's
// &pound;545M reading as those nine characters instead of £545M.
//
// Comments and processing instructions are skipped for the same reason, and
// for one more: a "<![CDATA[" written inside a comment is text, not an
// opener, and mistaking it for one would swallow the real markup after it.
const OPAQUE = /<!\[CDATA\[[\s\S]*?\]\]>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>/g;

function sanitizeEntities(xml: string): string {
  let out = "";
  let end = 0;
  for (const span of xml.matchAll(OPAQUE)) {
    out += sanitizeMarkup(xml.slice(end, span.index)) + span[0];
    end = span.index + span[0].length;
  }
  return out + sanitizeMarkup(xml.slice(end));
}

export function createRssAdapter(opts: {
  slug: string;
  url: string;
  mediaType?: "text" | "video";
}): Adapter {
  return {
    slug: opts.slug,
    mode: "body",
    async parse(body: string, since: Date): Promise<RawItem[]> {
      const feed = await parser.parseString(sanitizeEntities(body));
      const out: RawItem[] = [];
      let dropped = 0;
      for (const e of feed.items as FeedItem[]) {
        const publishedAt = new Date(e.isoDate ?? e.pubDate ?? Date.now());
        if (Number.isNaN(publishedAt.getTime()) || publishedAt < since) {
          dropped++;
          continue;
        }
        const externalId = e.guid ?? e.id ?? e.link;
        if (!externalId || !e.title) {
          dropped++;
          continue;
        }
        out.push({
          sourceSlug: opts.slug,
          externalId,
          // Decode before stripping, so a watermark that arrives as &#8203;
          // is a zero-width character by the time the stripper looks.
          title: stripInvisibles(decodeNumericRefs(e.title)),
          url: e.link,
          author: authorName(e.creator ?? e.author),
          publishedAt,
          // content:encoded and content are the full body where a feed sends
          // one; summary comes after them so a feed carrying both keeps the
          // body and falls back to the teaser only when there is no body.
          // simonwillison.net is the shape that needs it: <summary type="html">
          // and no <content>, so the chain used to end in the empty string.
          content: htmlToText(e["content:encoded"] ?? e.content ?? e.summary ?? e.contentSnippet ?? ""),
          mediaType: opts.mediaType ?? "text",
        });
      }
      info("rss parsed", { source: opts.slug, kept: out.length, dropped });
      return out;
    },
  };
}
