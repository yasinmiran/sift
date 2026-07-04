// Paywalled items are kept but flagged, so the digest can badge them and
// prefer links readers can actually open.

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
