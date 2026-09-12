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

// Syndicators tag the urls they carry, so a link copied out of the day's
// items reports sift's readers back to whoever forwarded the story (tldr
// stamps utm_source=tldrnewsletter on every link it sends). Named tags only,
// never the whole query: the same nyt link carries unlocked_article_code,
// and accessToken (bloomberg), reflink (wsj) and a youtube v= are the same
// kind of thing — drop those and the article stops opening.
const TRACKING = (name: string): boolean => name.startsWith("utm_") || name === "smid";

// A key is matched decoded (utm%5Fsource is utm_source to whoever reads it)
// and kept verbatim, so nothing but the tag itself is ever rewritten.
function paramName(param: string): string {
  const raw = param.split("=")[0]!;
  if (!raw.includes("%")) return raw;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** Drop a syndicator's tracking tags, keeping every other query param. */
export function stripTracking(url: string): string {
  // The fragment comes off first: a ? after a # is part of the fragment, not
  // a query, and teslarati sends links shaped exactly like that.
  const hash = url.indexOf("#");
  const base = hash < 0 ? url : url.slice(0, hash);
  const tail = hash < 0 ? "" : url.slice(hash);
  const q = base.indexOf("?");
  if (q < 0) return url;
  const params = base
    .slice(q + 1)
    .split("&")
    .filter(Boolean);
  const kept = params.filter((p) => !TRACKING(paramName(p)));
  if (kept.length === params.length) return url;
  return base.slice(0, q) + (kept.length > 0 ? `?${kept.join("&")}` : "") + tail;
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
