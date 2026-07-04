import { info } from "../../log";
import { withRetry } from "../retry";
import { htmlToText } from "./clean";
import type { Adapter, JsonFetcher, RawItem } from "./types";

interface HnOpts {
  minScore: number;
  maxItems: number;
  backfillDays: number;
}

interface AlgoliaHit {
  objectID: string;
  title?: string;
  url?: string;
  author?: string;
  points?: number;
  num_comments?: number;
  created_at_i: number;
  story_text?: string;
}

const ALGOLIA = "https://hn.algolia.com/api/v1";

const liveFetch: JsonFetcher = async (url) =>
  withRetry(async () => {
    const r = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!r.ok) throw new Error(`HN ${r.status} for ${url}`);
    return r.json();
  });

export function createHnAdapter(
  slug: string,
  opts: HnOpts,
  fetchJson: JsonFetcher = liveFetch,
): Adapter {
  return {
    slug,
    mode: "pull",
    async fetch(since: Date): Promise<RawItem[]> {
      const byId = new Map<string, RawItem>();

      // The literal front page: stories the community has already voted up
      // and that survived moderation, i.e. matured signal, one request.
      const front = (await fetchJson(
        `${ALGOLIA}/search?tags=front_page&hitsPerPage=${opts.maxItems}`,
      )) as { hits?: AlgoliaHit[] } | null;
      for (const h of hitsOf(front)) {
        const mapped = mapHit(slug, h, opts.minScore);
        if (mapped) byId.set(mapped.externalId, mapped);
      }

      // High scorers that already rotated off the front page within the window.
      const cutoff = Date.now() - opts.backfillDays * 86_400_000;
      if (opts.backfillDays > 0 && since.getTime() <= cutoff) {
        const sinceEpoch = Math.floor(since.getTime() / 1000);
        const backfill = (await fetchJson(
          `${ALGOLIA}/search_by_date?tags=story` +
            `&numericFilters=points>=${opts.minScore},created_at_i>${sinceEpoch}`,
        )) as { hits?: AlgoliaHit[] } | null;
        for (const h of hitsOf(backfill)) {
          const mapped = mapHit(slug, h, opts.minScore);
          if (mapped && !byId.has(mapped.externalId)) byId.set(mapped.externalId, mapped);
        }
      }

      const items = [...byId.values()].slice(0, opts.maxItems);
      info("hn fetched", { source: slug, kept: items.length });
      return items;
    },
  };
}

const hitsOf = (res: { hits?: AlgoliaHit[] } | null): AlgoliaHit[] =>
  res && Array.isArray(res.hits) ? res.hits : [];

function mapHit(slug: string, h: AlgoliaHit, minScore: number): RawItem | null {
  if (!h.title || (h.points ?? 0) < minScore) return null;
  const publishedAt = new Date(h.created_at_i * 1000);
  if (Number.isNaN(publishedAt.getTime())) return null;
  return {
    sourceSlug: slug,
    externalId: String(h.objectID),
    title: h.title,
    url: h.url,
    author: h.author,
    publishedAt,
    content: htmlToText(h.story_text ?? ""),
    points: h.points,
    comments: h.num_comments,
  };
}
