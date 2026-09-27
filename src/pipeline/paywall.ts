// Paywalled items are kept but flagged, so the digest can badge them and
// prefer links readers can actually open. The flag is about the link, not the
// publisher: a gift link on a hard-paywall domain is one the reader can open.

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

// A gift link: the publisher issued this url so the article opens for whoever
// follows it, which beats the domain guess for that one link. clean.ts keeps
// these params for the same reason ("drop those and the article stops
// opening"); this is the other half of that.
//
// By name, because the name is the claim: `unlocked_article_code` (nyt),
// `accessToken` (bloomberg, ft). By value where the name is not:
// `sharetype=gift` (ft). An empty value is no token.
//
// wsj's `?st=...&reflink=desktopwebshare_permalink` is deliberately absent: a
// share permalink is not a gift, and it lands on the same wall.
const UNLOCK_PARAMS = ["unlocked_article_code", "accessToken"];

function isUnlocked(url: string): boolean {
  let params: URLSearchParams;
  try {
    params = new URL(url).searchParams;
  } catch {
    return false;
  }
  if (UNLOCK_PARAMS.some((name) => (params.get(name) ?? "") !== "")) return true;
  return params.get("sharetype")?.toLowerCase() === "gift";
}

export function isPaywalled({ url, content }: UrlLike): boolean {
  if (url && isPaywalledDomain(url) && !isUnlocked(url)) return true;
  if (content) {
    const body = content.toLowerCase();
    if (PAYWALL_PHRASES.some((p) => body.includes(p))) return true;
  }
  return false;
}
