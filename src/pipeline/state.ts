// data/state.json: the pipeline's memory between runs. Two structures:
// per-source conditional-GET validators, and the seen index. The index is
// keyed by day so pruning old keys is a plain date comparison, and it
// remembers item identity (`sourceSlug:externalId`) for SEEN_DAYS so a
// story bouncing between feeds, or a feed replaying old entries, cannot
// re-enter a later day.
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
const SEEN_DAYS = 7;

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

const statePath = (dataDir: string): string => join(dataDir, "state.json");
