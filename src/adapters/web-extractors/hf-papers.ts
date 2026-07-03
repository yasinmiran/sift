import * as cheerio from "cheerio";
import { truncate } from "../clean";
import type { RawItem } from "../types";

const BASE = "https://huggingface.co";
const PAPER_PATH = /^\/papers\/[\w.-]+$/;

/** Extract the day's papers from the Hugging Face daily-papers page. Each paper
 *  renders several anchors (image card, title, community tab); the title anchor
 *  is the one with headline text and no fragment. */
export function hfPapersExtract(indexHtml: string, sourceSlug: string): RawItem[] {
  const $ = cheerio.load(indexHtml);
  const now = new Date();
  const seen = new Map<string, RawItem>();
  $('a[href^="/papers/"]').each((_, el) => {
    const $el = $(el);
    const href = $el.attr("href");
    if (!href || !PAPER_PATH.test(href)) return;
    const title = $el.text().replace(/\s+/g, " ").trim();
    if (!title) return;
    const url = new URL(href, BASE).toString();
    if (seen.has(url)) return;
    seen.set(url, {
      sourceSlug,
      externalId: url,
      title: truncate(title, 200),
      url,
      publishedAt: now,
      content: title,
    });
  });
  return [...seen.values()];
}

export { BASE };
