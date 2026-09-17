import * as cheerio from "cheerio";

// Zero-width characters some feeds inject as anti-scrape watermarks
// (stackoverflow.blog stamps ~1k of them into every title).
const INVISIBLES = /[\u200B-\u200D\uFEFF]/g;

export const stripInvisibles = (s: string): string => s.replace(INVISIBLES, "");

// A numeric reference written inside CDATA is literal text, not a reference,
// so the xml parser hands it on as-is and the-verge's titles arrive spelled
// "Apple&#8217;s". Content is spared because it goes through cheerio; a title
// never does, which is why this exists rather than reusing htmlToText — that
// would also read a title's <<History>> as a tag and eat it.
const NUMERIC_REF = /&#(?:(\d{1,7})|[xX]([0-9a-fA-F]{1,6}));/g;

/** Decode numeric character references, once, leaving anything else alone. */
export function decodeNumericRefs(s: string): string {
  return s.replace(NUMERIC_REF, (whole, dec?: string, hex?: string) => {
    const code = dec === undefined ? Number.parseInt(hex!, 16) : Number.parseInt(dec, 10);
    // Nothing outside unicode, and no lone surrogate: String.fromCodePoint
    // throws on the first and the second only makes an unpaired half.
    if (code < 1 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return whole;
    return String.fromCodePoint(code);
  });
}

// An author arrives in three shapes. A plain string is the common one, and
// ars-technica's dc:creator is that string pretty-printed across lines. The
// third is an rss 2.0 <author> carrying child elements instead of text
// (blog.google, nextjs.org): the parser hands back its node for the whole
// element, name and job title and all, where the declared type says string.
// Atom's <author><name> never reaches here — rss-parser resolves that itself.
export function authorName(value: unknown): string | undefined {
  const raw =
    value !== null && typeof value === "object" && !Array.isArray(value) && "name" in value
      ? (value as { name: unknown }).name
      : value;
  const names = (Array.isArray(raw) ? raw : [raw])
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return names.length > 0 ? names.join(", ") : undefined;
}

// A style or script element carries text cheerio's .text() reads like any
// other, so a feed that ships its own markup chrome hands it straight to the
// summary: beehiiv stamps a table stylesheet into every tl;dr sec issue and
// all four in the archive open with the same 460 characters of css. Nothing
// inside either element is ever prose, so both go before the text is taken.
const NON_PROSE = "script, style";

export function htmlToText(html: string): string {
  const $ = cheerio.load(html);
  $(NON_PROSE).remove();
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
