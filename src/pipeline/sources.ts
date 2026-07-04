import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export interface SourceConfig {
  slug: string;
  kind: "hn" | "rss" | "web" | "arxiv";
  url?: string;
  topics: string[];
  enabled: boolean;
  mediaType?: "video";
}

const KINDS = new Set(["hn", "rss", "web", "arxiv"]);
const defaultPath = fileURLToPath(new URL("../../config/sources.json", import.meta.url));

export function loadSources(path: string = defaultPath): SourceConfig[] {
  const sources = JSON.parse(readFileSync(path, "utf8")) as SourceConfig[];
  for (const s of sources) {
    if (!s.slug || !KINDS.has(s.kind) || !Array.isArray(s.topics) || typeof s.enabled !== "boolean") {
      throw new Error(`invalid source entry: ${JSON.stringify(s)}`);
    }
  }
  return sources;
}
