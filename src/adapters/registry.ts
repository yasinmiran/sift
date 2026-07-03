import { createHnAdapter } from "./hn";
import { createRssAdapter } from "./rss";
import { createWebAdapter } from "./web";
import type { Adapter, HtmlFetcher, JsonFetcher } from "./types";
import type { SourceConfig } from "../sources";

/** Injected fetchers (live defaults in production, recorded stubs in tests). */
export interface Fetchers {
  fetchJson?: JsonFetcher;
  fetchHtml?: HtmlFetcher;
}

// HN carries no per-source tuning in the config; the rolling window supplies
// recency, so one day of Algolia backfill is enough on a cold source.
const HN_DEFAULTS = { lists: ["top", "best"], minScore: 100, maxItems: 60, backfillDays: 1 };

/** Resolve a source config to its adapter, keyed by the source slug. */
export function adapterFor(cfg: SourceConfig, fetchers: Fetchers = {}): Adapter {
  switch (cfg.kind) {
    case "hn":
      return createHnAdapter(cfg.slug, HN_DEFAULTS, fetchers.fetchJson);
    case "rss":
      return createRssAdapter({ slug: cfg.slug, url: requireUrl(cfg), mediaType: cfg.mediaType });
    case "web":
      return createWebAdapter(
        { slug: cfg.slug, url: requireUrl(cfg), extractor: cfg.slug },
        fetchers.fetchHtml,
      );
  }
}

function requireUrl(cfg: SourceConfig): string {
  if (!cfg.url) throw new Error(`source "${cfg.slug}" (${cfg.kind}) requires a url`);
  return cfg.url;
}
