// Sponsored inventory is dropped before storage: ads are noise, not news.
// Matches anchored markers only, never loose substrings, so "how we built
// an ad server" or "paid search economics" stay editorial.

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
