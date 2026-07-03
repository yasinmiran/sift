import * as cheerio from "cheerio";

export function htmlToText(html: string): string {
  const $ = cheerio.load(html);
  return $.root().text().replace(/\s+/g, " ").trim();
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
