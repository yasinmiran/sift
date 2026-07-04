import { tldrExtract, tldrResolveLatest } from "./web-extractors/tldr";
import { anthropicExtract } from "./web-extractors/anthropic";
import { alphasignalExtract } from "./web-extractors/alphasignal";
import { hfPapersExtract } from "./web-extractors/hf-papers";
import type { Adapter, HtmlFetcher, RawItem } from "./types";

export type Extractor = (html: string, sourceSlug: string) => RawItem[];
export type LatestResolver = (indexHtml: string, baseUrl: string) => string | undefined;

export const extractors: Record<string, Extractor> = {
  tldr: tldrExtract,
  "anthropic-news": anthropicExtract,
  alphasignal: alphasignalExtract,
  "hf-daily-papers": hfPapersExtract,
};

/** Optional second-fetch resolvers: archive index -> latest issue URL. */
export const resolvers: Record<string, LatestResolver | undefined> = { tldr: tldrResolveLatest };

const liveFetch: HtmlFetcher = async (url) => {
  const res = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0" },
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`web ${res.status} for ${url}`);
  return res.text();
};

export function createWebAdapter(
  opts: { slug: string; url: string; extractor: string },
  fetchHtml: HtmlFetcher = liveFetch,
): Adapter {
  const extract = extractors[opts.extractor];
  if (!extract) throw new Error(`unknown web extractor: ${opts.extractor}`);
  const resolve = resolvers[opts.extractor];
  return {
    slug: opts.slug,
    mode: "pull",
    async fetch(): Promise<RawItem[]> {
      const indexHtml = await fetchHtml(opts.url);
      const issueUrl = resolve?.(indexHtml, opts.url);
      const html = issueUrl ? await fetchHtml(issueUrl) : indexHtml;
      return extract(html, opts.slug);
    },
  };
}
