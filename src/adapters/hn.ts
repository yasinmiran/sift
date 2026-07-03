import { htmlToText } from "./clean";
import type { Adapter, JsonFetcher, RawItem } from "./types";

interface HnOpts {
  lists: string[];
  minScore: number;
  maxItems: number;
  backfillDays: number;
}

interface HnItem {
  id: number;
  type: string;
  by?: string;
  time: number;
  title?: string;
  url?: string;
  score?: number;
  text?: string;
}

interface AlgoliaHit {
  objectID: string;
  title?: string;
  url?: string;
  author?: string;
  points?: number;
  created_at_i: number;
  story_text?: string;
}

const FB = "https://hacker-news.firebaseio.com/v0";

const liveFetch: JsonFetcher = async (url) => {
  const r = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!r.ok) throw new Error(`HN ${r.status} for ${url}`);
  return r.json();
};

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

      for (const list of opts.lists) {
        const ids = await fetchJson(`${FB}/${list}stories.json`);
        if (!Array.isArray(ids)) continue;
        for (const id of ids.slice(0, opts.maxItems)) {
          const it = (await fetchJson(`${FB}/item/${id}.json`)) as HnItem | null;
          const mapped = mapFirebase(slug, it, opts.minScore);
          if (mapped) byId.set(mapped.externalId, mapped);
        }
      }

      const cutoff = Date.now() - opts.backfillDays * 86_400_000;
      if (opts.backfillDays > 0 && since.getTime() <= cutoff) {
        const sinceEpoch = Math.floor(since.getTime() / 1000);
        const url =
          `https://hn.algolia.com/api/v1/search_by_date?tags=story` +
          `&numericFilters=points>=${opts.minScore},created_at_i>${sinceEpoch}`;
        const res = (await fetchJson(url)) as { hits?: AlgoliaHit[] } | null;
        const hits = res && Array.isArray(res.hits) ? res.hits : [];
        for (const h of hits) {
          const mapped = mapAlgolia(slug, h);
          if (mapped && !byId.has(mapped.externalId)) byId.set(mapped.externalId, mapped);
        }
      }

      return [...byId.values()].slice(0, opts.maxItems);
    },
  };
}

function mapFirebase(slug: string, it: HnItem | null, minScore: number): RawItem | null {
  if (!it || it.type !== "story" || !it.title) return null;
  if ((it.score ?? 0) < minScore) return null;
  const publishedAt = new Date(it.time * 1000);
  if (Number.isNaN(publishedAt.getTime())) return null;
  return {
    sourceSlug: slug,
    externalId: String(it.id),
    title: it.title,
    url: it.url,
    author: it.by,
    publishedAt,
    content: htmlToText(it.text ?? ""),
    raw: it,
  };
}

function mapAlgolia(slug: string, h: AlgoliaHit): RawItem | null {
  if (!h.title) return null;
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
    raw: h,
  };
}
