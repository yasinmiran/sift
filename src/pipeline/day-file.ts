// data/items/{day}.json: one file per Oslo calendar day, the pipeline's
// only product. Append-only within the day, pruned after a month by
// cleanup.ts; git history keeps everything.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

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
  // hn only: front-page metrics, so the digest can weigh discussions
  // even when its environment cannot reach the Algolia API.
  points?: number;
  comments?: number;
}

export interface DayFile {
  day: string;
  generatedAt: string;
  items: StoredItem[];
}

export function loadDay(dataDir: string, day: string): DayFile {
  const path = dayPath(dataDir, day);
  if (!existsSync(path)) return { day, generatedAt: "", items: [] };
  return JSON.parse(readFileSync(path, "utf8")) as DayFile;
}

export function saveDay(dataDir: string, file: DayFile): void {
  file.items.sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
  const path = dayPath(dataDir, file.day);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(file, null, 2) + "\n");
}

const dayPath = (dataDir: string, day: string): string => join(dataDir, "items", `${day}.json`);
