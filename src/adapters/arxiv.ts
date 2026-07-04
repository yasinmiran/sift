import Parser from "rss-parser";
import { info } from "../log";
import type { Adapter, RawItem } from "./types";

// arXiv category feeds (rss.arxiv.org/rss/cat.A+cat.B) per
// info.arxiv.org/help/rss_specifications.html: one feed per day, empty on
// weekends, every item carrying arxiv:announce_type. Only "new" is news;
// "replace" and "cross" re-announce papers the feed already carried once.
const ANNOUNCE_KEEP = "new";
const ABSTRACT_PREFIX = /^arXiv:\S+\s+Announce Type:\s*\S+\s*(Abstract:\s*)?/;

type ArxivItem = {
  title?: string;
  link?: string;
  guid?: string;
  creator?: string;
  pubDate?: string;
  isoDate?: string;
  description?: string;
  announceType?: string;
};

const parser = new Parser({
  customFields: { item: [["arxiv:announce_type", "announceType"], ["description", "description"]] },
});

export function createArxivAdapter(opts: { slug: string; url: string; maxItems?: number }): Adapter {
  const maxItems = opts.maxItems ?? 25;
  return {
    slug: opts.slug,
    mode: "body",
    async parse(body: string, since: Date): Promise<RawItem[]> {
      const feed = await parser.parseString(body);
      const out: RawItem[] = [];
      let skipped = 0;
      for (const e of feed.items as ArxivItem[]) {
        if (out.length >= maxItems) break;
        const publishedAt = new Date(e.isoDate ?? e.pubDate ?? NaN);
        const abstract = (e.description ?? "").replace(ABSTRACT_PREFIX, "").replace(/\s+/g, " ").trim();
        if (
          e.announceType !== ANNOUNCE_KEEP ||
          !e.guid ||
          !e.title ||
          Number.isNaN(publishedAt.getTime()) ||
          publishedAt < since
        ) {
          skipped++;
          continue;
        }
        out.push({
          sourceSlug: opts.slug,
          externalId: e.guid,
          title: e.title,
          url: e.link,
          author: e.creator,
          publishedAt,
          content: abstract,
          mediaType: "text",
        });
      }
      info("arxiv parsed", { source: opts.slug, kept: out.length, skipped });
      return out;
    },
  };
}
