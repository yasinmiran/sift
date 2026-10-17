// data/state.json: the pipeline's memory between runs. Two structures:
// per-source conditional-GET validators, and the seen index. The index is
// keyed by day so pruning old keys is a plain date comparison, and it
// remembers item identity (`sourceSlug:externalId`) for SEEN_DAYS so a
// story bouncing between feeds, or a feed replaying old entries, cannot
// re-enter a later day. Both halves are pruned every run: the index by
// date, the validators by the registry, so a slug dropped from
// config/sources.json cannot hand stale validators back to a slug of the
// same name later and turn its first fetch into a 304 nobody ordered.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { daysBefore } from "../day";

export interface SourceState {
  etag: string | null;
  lastModified: string | null;
  feedHash: string | null;
}

export interface IngestState {
  sources: Record<string, SourceState>;
  seen: Record<string, string[]>;
}

// The dedup horizon: an item reappearing within this many days is skipped.
// verify.ts reads it too, to tell a story carried over from a recent day
// apart from a url that was never ingested at all.
export const SEEN_DAYS = 7;

export const itemKey = (i: { sourceSlug: string; externalId: string }): string =>
  `${i.sourceSlug}:${i.externalId}`;

export function loadState(dataDir: string): IngestState {
  const path = statePath(dataDir);
  if (!existsSync(path)) return { sources: {}, seen: {} };
  return JSON.parse(readFileSync(path, "utf8")) as IngestState;
}

export function saveState(dataDir: string, state: IngestState): void {
  const path = statePath(dataDir);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(state, null, 2) + "\n");
}

export function isSeen(state: IngestState, key: string): boolean {
  return Object.values(state.seen).some((keys) => keys.includes(key));
}

export function markSeen(state: IngestState, day: string, key: string): void {
  (state.seen[day] ??= []).push(key);
}

export function pruneSeen(state: IngestState, today: string): void {
  const cutoff = daysBefore(today, SEEN_DAYS - 1);
  for (const day of Object.keys(state.seen)) if (day < cutoff) delete state.seen[day];
}

// Pruned against the whole registry, not the enabled subset the fetch loop
// walks: a source switched off keeps its validators, so switching it back on
// still costs one conditional GET rather than a full re-read.
export function pruneSources(state: IngestState, slugs: Iterable<string>): void {
  const known = new Set(slugs);
  for (const slug of Object.keys(state.sources)) if (!known.has(slug)) delete state.sources[slug];
}

const statePath = (dataDir: string): string => join(dataDir, "state.json");
