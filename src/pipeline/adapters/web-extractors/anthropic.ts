import * as cheerio from "cheerio";
import { htmlToText, truncate } from "../clean";
import type { RawItem } from "../types";

const BASE = "https://www.anthropic.com";
const DATE = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4}/;

const HEADING = "h1,h2,h3,h4,h5,h6";
// A bound on the walk, not a tuning knob: the shapes in hand need one step
// (the tiles) and two (the listing rows), and nothing on the page should put a
// story's own date six levels above its link.
const CARD_DEPTH = 6;

type Selection = ReturnType<cheerio.CheerioAPI>;

/** The card a story's link belongs to: the nearest ancestor carrying a <time>.
 *  The index renders a story's date and deck as siblings of its link rather
 *  than inside it (the featured cards wrap both in an <article>, the listing
 *  rows in a summary cell), so the date has to be looked for around the link
 *  and not in it. */
function cardOf($el: Selection): Selection {
  let card = $el;
  for (let i = 0; i < CARD_DEPTH; i++) {
    if (card.find("time").length > 0) break;
    const parent = card.parent();
    // A second headline means the ancestor holds a second story, so it is the
    // grid and not the card. Stop short of it and leave this story undated
    // rather than lend it a neighbour's date.
    if (!parent.length || parent.is("body") || parent.find(HEADING).length > 1) break;
    card = parent;
  }
  return card;
}

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

    const heading = $el.find(HEADING).first().text().trim();
    const title = heading || $el.children().not(":has(time)").last().text().trim();
    if (!title) return;

    const card = cardOf($el);
    const publishedAt = new Date(card.find("time").first().text().trim() || DATE.exec(card.text())?.[0] || "");
    // No date, no item. A card the walk cannot date used to be stamped with the
    // clock, which reads as today's news to every stage downstream: the 48h
    // window in ingest.ts passes it whatever its real age (the index carries
    // posts up to 50 days old), and because the stamp moves with the run, the
    // story re-enters a day file every time the 7-day seen index forgets it.
    // Going quiet instead leaves the breakage in the run log's kept count.
    if (Number.isNaN(publishedAt.getTime())) return;

    // The category chip is a paragraph wrapping a link; the deck is prose.
    const deck = htmlToText(card.find("p").not(":has(a)").first().html() ?? "");
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
