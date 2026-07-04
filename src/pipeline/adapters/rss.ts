import Parser from "rss-parser";
import { info } from "../../log";
import { htmlToText } from "./clean";
import type { Adapter, RawItem } from "./types";

type ParsedFeed = Awaited<ReturnType<Parser["parseString"]>>;
type FeedItem = ParsedFeed["items"][number] & {
  "content:encoded"?: string;
  creator?: string;
  id?: string;
};

const parser = new Parser();

// XML only defines five named entities; feeds routinely leak html ones
// (tldrsec's &nbsp; kills the whole parse). Map the common ones to numeric
// refs and neutralize the rest so one sloppy entity never costs a feed.
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

function sanitizeEntities(xml: string): string {
  return xml.replace(/&([a-zA-Z][a-zA-Z0-9]{1,31});/g, (whole, name: string) =>
    XML_NATIVE.has(name) ? whole : (HTML_ENTITIES[name] ?? `&amp;${name};`),
  );
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
          title: e.title,
          url: e.link,
          author: e.creator ?? e.author,
          publishedAt,
          content: htmlToText(e["content:encoded"] ?? e.content ?? e.contentSnippet ?? ""),
          mediaType: opts.mediaType ?? "text",
        });
      }
      info("rss parsed", { source: opts.slug, kept: out.length, dropped });
      return out;
    },
  };
}
