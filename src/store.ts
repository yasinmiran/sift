// The committed files are the whole database. Two of them:
//
//   data/items/{day}.json  one DayFile per Oslo calendar day, append-only
//                          within the day, pruned after a month
//   data/state.json        per-source conditional-GET validators plus the
//                          seen index, keyed by day so pruning old keys is
//                          a plain date comparison
//
// Item identity is `sourceSlug:externalId`; the seen index carries it for
// SEEN_DAYS so a story bouncing between feeds (or a feed replaying old
// entries) cannot re-enter a later day.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { daysBefore } from "./day";

export interface StoredItem {
  sourceSlug: string;
  externalId: string;
  title: string;
  url: string | null;
  author: string | null;
  publishedAt: string;
  content: string;
  topics: string[];
  paywalled: boolean;
  mediaType: "text" | "video";
}

export interface DayFile {
  day: string;
  generatedAt: string;
  items: StoredItem[];
}

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

export const itemKey = (i: Pick<StoredItem, "sourceSlug" | "externalId">): string =>
  `${i.sourceSlug}:${i.externalId}`;

export function loadState(dataDir: string): IngestState {
  const path = join(dataDir, "state.json");
  if (!existsSync(path)) return { sources: {}, seen: {} };
  return JSON.parse(readFileSync(path, "utf8")) as IngestState;
}

export function saveState(dataDir: string, state: IngestState): void {
  writeJson(join(dataDir, "state.json"), state);
}

export function loadDay(dataDir: string, day: string): DayFile {
  const path = dayPath(dataDir, day);
  if (!existsSync(path)) return { day, generatedAt: "", items: [] };
  return JSON.parse(readFileSync(path, "utf8")) as DayFile;
}

export function saveDay(dataDir: string, file: DayFile): void {
  file.items.sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
  writeJson(dayPath(dataDir, file.day), file);
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

const dayPath = (dataDir: string, day: string): string => join(dataDir, "items", `${day}.json`);

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
}
