/**
 * Editorial classification applied at ingest. Two independent policies:
 *
 *  - `isPromotional` → dropped before storage (sponsor/ad inventory is noise).
 *  - `isPaywalled`   → kept but flagged, so the UI can badge it and the digest
 *                       can prefer links readers can actually open.
 *
 * Both match anchored markers, never loose substrings, so "how we built an ad
 * server" or "paid search economics" stay editorial.
 */

interface TitleLike {
  title: string;
  content?: string;
  url?: string;
}

// The parenthetical/bracketed tag newsletters append to inventory: "(Sponsor)",
// "(Sponsored)", "[Sponsored]", "(Promoted)", "(Paid)", "(Ad)".
const TAGGED = /[(\[]\s*(sponsor(?:ed)?|promoted|paid|advertisement|ad)\s*[)\]]/i;
// The label-prefix form: "Sponsored:", "Advertisement -", "Partner Content:".
const LABELLED = /^\s*(sponsored|sponsor|advertisement|promoted|partner content)\s*[:-]/i;

const looksPromotional = (text: string): boolean => TAGGED.test(text) || LABELLED.test(text);

// Paid-placement utm values. utm_source stays out: newsletters stamp it on
// editorial links too (utm_source=tldrnewsletter), so it carries no signal.
const PROMO_UTM: Record<string, RegExp> = {
  utm_medium: /^(sponsor(ed)?|paid(-.+)?|ads?|cpc|ppc)$/i,
  utm_campaign: /sponsor|advertis|promo/i,
  utm_content: /^cta_|sponsor|advertis|promo/i,
};

function looksPromotionalUrl(url: string): boolean {
  let params: URLSearchParams;
  try {
    params = new URL(url).searchParams;
  } catch {
    return false;
  }
  return Object.entries(PROMO_UTM).some(([key, re]) => {
    const value = params.get(key);
    return value !== null && re.test(value);
  });
}

export function isPromotional({ title, content, url }: TitleLike): boolean {
  if (looksPromotional(title)) return true;
  if (url && looksPromotionalUrl(url)) return true;
  // Some feeds keep the headline clean and tag the body's opening line instead.
  const firstLine = (content ?? "").split("\n", 1)[0] ?? "";
  return looksPromotional(firstLine);
}

interface UrlLike {
  url?: string;
  content?: string;
}

// Hard paywalls: the headline is signal, the body is locked. Hostname-suffix match
// so `www.wsj.com` and `wsj.com` both hit.
const PAYWALL_DOMAINS = [
  "theinformation.com",
  "wsj.com",
  "nytimes.com",
  "ft.com",
  "bloomberg.com",
  "economist.com",
  "newyorker.com",
  "theatlantic.com",
  "businessinsider.com",
];

// Subscriber-only stubs that show up in the RSS body regardless of domain.
const PAYWALL_PHRASES = [
  "this post is for paid subscribers",
  "for paid subscribers",
  "subscribe to keep reading",
  "subscribe to read",
  "become a paid subscriber",
  "to continue reading",
];

function isPaywalledDomain(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return PAYWALL_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

export function isPaywalled({ url, content }: UrlLike): boolean {
  if (url && isPaywalledDomain(url)) return true;
  if (content) {
    const body = content.toLowerCase();
    if (PAYWALL_PHRASES.some((p) => body.includes(p))) return true;
  }
  return false;
}
