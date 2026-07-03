import * as cheerio from "cheerio";
import { htmlToText, truncate } from "../clean";
import type { RawItem } from "../types";

const BASE = "https://tldr.tech";
const READ_TIME = /\s*\(\d+\s+minute\s+\w+\)\s*$/i;

/** Find the newest dated issue link on the archive index page. */
export function tldrResolveLatest(indexHtml: string, baseUrl: string): string | undefined {
  const $ = cheerio.load(indexHtml);
  const href = $('a[href]')
    .map((_, el) => $(el).attr("href"))
    .get()
    .find((h) => /^\/tech\/\d{4}-\d{2}-\d{2}$/.test(h ?? ""));
  if (!href) return undefined;
  return new URL(href, baseUrl).toString();
}

/** Extract individual stories from a TLDR issue page. */
export function tldrExtract(issueHtml: string, sourceSlug: string): RawItem[] {
  const $ = cheerio.load(issueHtml);
  const seen = new Map<string, RawItem>();
  $("article").each((_, el) => {
    const $el = $(el);
    const title = $el.find("h3").first().text().trim().replace(READ_TIME, "");
    const href = (
      $el.find('a[href^="http"]').first().attr("href") ??
      $el.find("a[href]").first().attr("href") ??
      ""
    ).replace(/&amp;/g, "&");
    if (!title || !/^https?:\/\//.test(href)) return;
    const content = htmlToText($el.html() ?? "");
    if (!seen.has(href)) {
      seen.set(href, {
        sourceSlug,
        externalId: href,
        title: truncate(title, 200),
        url: href,
        publishedAt: new Date(),
        content: content || title,
      });
    }
  });
  return [...seen.values()];
}

export { BASE };
