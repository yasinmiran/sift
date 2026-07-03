import * as cheerio from "cheerio";
import { truncate } from "../clean";
import type { RawItem } from "../types";

const BASE = "https://alphasignal.ai";
const RELATIVE = /(\d+)\s+(min(?:ute)?|hour|day|week|month)s?\s+ago/i;
const UNIT_MS: Record<string, number> = {
  min: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
  week: 604_800_000,
  month: 2_592_000_000,
};

type Cheerio = ReturnType<typeof cheerio.load>;

/** Walk up to the largest ancestor that still wraps exactly one story headline. */
function cardRoot($: Cheerio, $el: ReturnType<Cheerio>): ReturnType<Cheerio> {
  let node = $el;
  for (let i = 0; i < 6; i++) {
    const parent = node.parent();
    if (!parent.length) break;
    const headlines = parent
      .find('a[href^="/news/"]')
      .filter((_, a) => $(a).text().replace(/\s+/g, " ").trim().length > 0).length;
    if (headlines > 1) break;
    node = parent;
  }
  return node;
}

/** AlphaSignal renders relative dates ("46 mins ago"); resolve against fetch time. */
function parseRelative(text: string, now: number): Date | undefined {
  const m = RELATIVE.exec(text);
  if (!m) return undefined;
  const key = m[2]!.toLowerCase().slice(0, m[2]!.toLowerCase().startsWith("min") ? 3 : undefined);
  const ms = UNIT_MS[key];
  if (!ms) return undefined;
  return new Date(now - Number(m[1]) * ms);
}

/** Extract story headlines from the AlphaSignal home/latest page. */
export function alphasignalExtract(indexHtml: string, sourceSlug: string): RawItem[] {
  const $ = cheerio.load(indexHtml);
  const now = Date.now();
  const seen = new Map<string, RawItem>();
  $('a[href^="/news/"]').each((_, el) => {
    const $el = $(el);
    const title = $el.text().replace(/\s+/g, " ").trim();
    const href = $el.attr("href");
    if (!title || !href) return; // image-only anchors carry no headline text
    const url = new URL(href, BASE).toString();
    if (seen.has(url)) return;
    const publishedAt = parseRelative(cardRoot($, $el).text(), now) ?? new Date(now);
    seen.set(url, {
      sourceSlug,
      externalId: url,
      title: truncate(title, 200),
      url,
      publishedAt,
      content: title,
    });
  });
  return [...seen.values()];
}

export { BASE };
