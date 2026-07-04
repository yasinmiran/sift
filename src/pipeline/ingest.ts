// The pipeline's write path, one pass per run:
//
//   sources.json -> fetch (conditional GET where the adapter allows it)
//   -> adapter parse -> 24h publishedAt window -> promo filter -> 7-day
//   dedup -> append to data/items/{day}.json + mark seen in state.json
//
// Idempotent by design: the Action runs it twice a day and anyone can run
// it again; unchanged feeds are skipped, seen items never duplicate, and
// files are only rewritten when their content actually changed (so the
// Action's commit step stays a no-op on quiet runs).
import { resolve } from "node:path";
import { today } from "../day";
import { warn } from "../log";
import { adapterFor, type Fetchers } from "./adapters/registry";
import { safeHttpUrl } from "./adapters/clean";
import type { RawItem } from "./adapters/types";
import { loadDay, saveDay, type StoredItem } from "./day-file";
import { fetchIfChanged, type FetchImpl } from "./fetch";
import { isPaywalled } from "./paywall";
import { isPromotional } from "./promo";
import { loadSources, type SourceConfig } from "./sources";
import {
  isSeen,
  itemKey,
  loadState,
  markSeen,
  pruneSeen,
  saveState,
  type IngestState,
  type SourceState,
} from "./state";

const WINDOW_MS = 24 * 60 * 60 * 1000;

export interface IngestStats {
  sources: number;
  created: number;
  skipped: number;
  dropped: number;
  stale: number;
  failures: string[];
}

export async function runIngest(
  dataDir: string,
  deps: { fetchImpl?: FetchImpl; fetchers?: Fetchers; sources?: SourceConfig[] } = {},
): Promise<IngestStats> {
  const stats: IngestStats = { sources: 0, created: 0, skipped: 0, dropped: 0, stale: 0, failures: [] };
  const since = new Date(Date.now() - WINDOW_MS);
  const day = today();
  const state = loadState(dataDir);
  const stateSnapshot = JSON.stringify(state);
  const file = loadDay(dataDir, day);
  const fileExisted = file.generatedAt !== "";
  const itemsBefore = file.items.length;

  for (const source of (deps.sources ?? loadSources()).filter((s) => s.enabled)) {
    stats.sources++;
    try {
      const adapter = adapterFor(source, deps.fetchers ?? {});
      let items: RawItem[];
      if (adapter.mode === "pull") {
        items = await adapter.fetch(since);
      } else {
        const prev = sourceState(state, source.slug);
        const outcome = await fetchIfChanged(source.url!, prev, deps.fetchImpl);
        if (!outcome.changed) {
          Object.assign(prev, outcome.state);
          stats.skipped++;
          continue;
        }
        items = await adapter.parse(outcome.body!, since);
        Object.assign(prev, outcome.state);
      }
      for (const item of items) {
        if (item.publishedAt.getTime() < since.getTime()) {
          stats.stale++;
          continue;
        }
        if (isPromotional(item)) {
          stats.dropped++;
          continue;
        }
        const key = itemKey(item);
        if (isSeen(state, key)) continue;
        file.items.push(toStored(item, source.topics));
        markSeen(state, day, key);
        stats.created++;
      }
    } catch (e) {
      stats.failures.push(source.slug);
      warn("source failed", { source: source.slug, error: String(e) });
    }
  }

  if (!fileExisted || file.items.length > itemsBefore) {
    file.generatedAt = new Date().toISOString();
    saveDay(dataDir, file);
  }
  pruneSeen(state, day);
  if (JSON.stringify(state) !== stateSnapshot) saveState(dataDir, state);
  return stats;
}

function sourceState(state: IngestState, slug: string): SourceState {
  return (state.sources[slug] ??= {
    etag: null,
    lastModified: null,
    feedHash: null,
  });
}

function toStored(raw: RawItem, topics: string[]): StoredItem {
  return {
    sourceSlug: raw.sourceSlug,
    externalId: raw.externalId,
    title: raw.title,
    url: safeHttpUrl(raw.url),
    author: raw.author ?? null,
    publishedAt: raw.publishedAt.toISOString(),
    content: raw.content,
    topics,
    paywalled: raw.paywalled ?? isPaywalled(raw),
    mediaType: raw.mediaType ?? "text",
    ...(raw.points !== undefined && { points: raw.points }),
    ...(raw.comments !== undefined && { comments: raw.comments }),
  };
}

const invokedDirectly = process.argv[1]?.endsWith("ingest.ts");
if (invokedDirectly) {
  const stats = await runIngest(resolve("data"));
  console.log(JSON.stringify(stats));
}
