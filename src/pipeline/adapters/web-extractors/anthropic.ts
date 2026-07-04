import * as cheerio from "cheerio";
import { htmlToText, truncate } from "../clean";
import type { RawItem } from "../types";

const BASE = "https://www.anthropic.com";
const DATE = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4}/;

/** Extract the news cards from the Anthropic /news index. */
export function anthropicExtract(indexHtml: string, sourceSlug: string): RawItem[] {
  const $ = cheerio.load(indexHtml);
  const seen = new Map<string, RawItem>();
  $('a[href^="/news/"]').each((_, el) => {
    const $el = $(el);
    const href = $el.attr("href");
    if (!href) return;
    const url = new URL(href, BASE).toString();
    if (seen.has(url)) return;

    const heading = $el.find("h1,h2,h3,h4,h5,h6").first().text().trim();
    const title = heading || $el.children().not(":has(time)").last().text().trim();
    const dateText = $el.find("time").first().text().trim() || DATE.exec($el.text())?.[0] || "";
    const publishedAt = dateText ? new Date(dateText) : new Date();
    if (!title || Number.isNaN(publishedAt.getTime())) return;

    const deck = htmlToText($el.find("p").first().html() ?? "");
    seen.set(url, {
      sourceSlug,
      externalId: url,
      title: truncate(title, 200),
      url,
      publishedAt,
      content: deck || title,
    });
  });
  return [...seen.values()];
}

export { BASE };
