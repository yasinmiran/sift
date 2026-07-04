import * as cheerio from "cheerio";

// Zero-width characters some feeds inject as anti-scrape watermarks
// (stackoverflow.blog stamps ~1k of them into every title).
const INVISIBLES = /[\u200B-\u200D\uFEFF]/g;

export const stripInvisibles = (s: string): string => s.replace(INVISIBLES, "");

export function htmlToText(html: string): string {
  const $ = cheerio.load(html);
  return stripInvisibles($.root().text()).replace(/\s+/g, " ").trim();
}

export function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + "…" : s;
}

/** Keep a url only if it is absolute http(s); anything else (javascript:, data:,
 *  relative, malformed) collapses to null to defuse stored-href XSS at ingest. */
export function safeHttpUrl(url?: string): string | null {
  if (!url) return null;
  try {
    const { protocol } = new URL(url);
    return protocol === "http:" || protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}
