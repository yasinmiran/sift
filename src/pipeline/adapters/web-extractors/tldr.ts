import * as cheerio from "cheerio";
import { htmlToText, truncate } from "../clean";
import type { RawItem } from "../types";

const BASE = "https://tldr.tech";
const READ_TIME = /\s*\(\d+\s+minute\s+\w+\)\s*$/i;
const ISSUE_PATH = /^\/tech\/\d{4}-\d{2}-\d{2}$/;
// Anchored at the end (a trailing slash aside) so only an issue url dates an
// issue: a deeper path under the same date is another page, not the issue.
const ISSUE_DATE = /\/tech\/(\d{4}-\d{2}-\d{2})\/?$/;

/** Find the newest dated issue link on the archive index page. */
export function tldrResolveLatest(indexHtml: string, baseUrl: string): string | undefined {
  const $ = cheerio.load(indexHtml);
  const href = $('a[href]')
    .map((_, el) => $(el).attr("href"))
    .get()
    .find((h) => ISSUE_PATH.test(h ?? ""));
  if (!href) return undefined;
  return new URL(href, baseUrl).toString();
}

/** Extract individual stories from a TLDR issue page, dated by the issue. */
export function tldrExtract(issueHtml: string, sourceSlug: string, pageUrl?: string): RawItem[] {
  // The issue's own date, off the url the resolver matched to find it: one
  // newsletter, one send date, and the same string `tldrResolveLatest`
  // already read, so the date and the page it dates cannot disagree.
  // Without it there is no item. Every story used to be stamped
  // `new Date()`, which reads as this minute's news to every stage
  // downstream: the 48h window in ingest.ts passes it whatever the issue's
  // real age, and a day file's ordering follows the run rather than the
  // newsletter. Going quiet instead leaves an archive index that stopped
  // resolving an issue (so this is the index page, which carries no date)
  // in the run log's kept count, rather than in a day file as today's news.
  const day = ISSUE_DATE.exec(pageUrl ?? "")?.[1];
  if (!day) return [];
  const publishedAt = new Date(`${day}T00:00:00.000Z`);
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
        publishedAt,
        content: content || title,
      });
    }
  });
  return [...seen.values()];
}

export { BASE };
