export interface RawItem {
  sourceSlug: string;
  externalId: string;
  title: string;
  url?: string;
  author?: string;
  publishedAt: Date;
  content: string;
  paywalled?: boolean;
  mediaType?: "text" | "video";
  raw?: unknown;
}

/** rss adapters parse a body the ingest layer fetched conditionally; hn and
 *  web adapters pull themselves (hn is a JSON API, web needs a two-hop
 *  archive -> latest-issue fetch that conditional caching cannot model). */
export type Adapter =
  | { slug: string; mode: "pull"; fetch(since: Date): Promise<RawItem[]> }
  | { slug: string; mode: "body"; parse(body: string, since: Date): Promise<RawItem[]> };

export type JsonFetcher = (url: string) => Promise<unknown>;
export type HtmlFetcher = (url: string) => Promise<string>;
