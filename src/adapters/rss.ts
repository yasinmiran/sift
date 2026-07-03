import Parser from "rss-parser";
import { htmlToText } from "./clean";
import type { Adapter, RawItem } from "./types";

type ParsedFeed = Awaited<ReturnType<Parser["parseString"]>>;
type FeedItem = ParsedFeed["items"][number] & {
  "content:encoded"?: string;
  creator?: string;
  id?: string;
};

const parser = new Parser();

const log = (msg: string, fields: Record<string, unknown>): void =>
  console.log(JSON.stringify({ level: "info", msg, ...fields }));

export function createRssAdapter(opts: {
  slug: string;
  url: string;
  mediaType?: "text" | "video";
}): Adapter {
  return {
    slug: opts.slug,
    mode: "body",
    async parse(body: string, since: Date): Promise<RawItem[]> {
      const feed = await parser.parseString(body);
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
          raw: e,
        });
      }
      log("rss parsed", { source: opts.slug, kept: out.length, dropped });
      return out;
    },
  };
}
