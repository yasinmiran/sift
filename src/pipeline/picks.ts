import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { daysBefore } from "../day";

// Yasin's hand-found items: data/picks/{day}.json, written by the picks
// workflow from `pick:` issues and read by the digest routine and verify.
export interface Pick {
  url: string;
  title?: string;
  note?: string;
  addedAt: string;
}

export interface Picks {
  day: string;
  summary?: string;
  items: Pick[];
}

const URL_RE = /https?:\/\/[^\s)>\]]+/;

const normalize = (url: string): string => url.replace(/\/+$/, "");

/** Give a scheme-less url the https it meant. */
export const ensureScheme = (url: string): string =>
  /^https?:\/\//.test(url) ? url : `https://${url}`;

/** Read and validate a day's picks; null when the day has none. */
export function readPicks(rootDir: string, day: string): Picks | null {
  const path = join(rootDir, "data", "picks", `${day}.json`);
  if (!existsSync(path)) return null;
  const file = `data/picks/${day}.json`;
  const parsed = JSON.parse(readFileSync(path, "utf8")) as Picks;
  if (parsed.day !== day) throw new Error(`${file}: day ${parsed.day} does not match the filename`);
  if (parsed.summary !== undefined && typeof parsed.summary !== "string") {
    throw new Error(`${file}: summary must be a string`);
  }
  if (!Array.isArray(parsed.items)) throw new Error(`${file}: items must be an array`);
  for (const item of parsed.items) {
    if (typeof item?.url !== "string" || !URL_RE.test(item.url)) {
      throw new Error(`${file}: every item needs an http(s) url`);
    }
    if (typeof item.addedAt !== "string") throw new Error(`${file}: every item needs addedAt`);
  }
  return parsed;
}

/** Append a pick to a day, url-deduped; returns the existing object untouched on a repeat. */
export function applyPick(
  existing: Picks | null,
  day: string,
  pick: Pick,
): { picks: Picks; added: boolean } {
  const picks = existing ?? { day, items: [] };
  if (picks.items.some((i) => normalize(i.url) === normalize(pick.url))) {
    return { picks, added: false };
  }
  return { picks: { ...picks, items: [...picks.items, pick] }, added: true };
}

/**
 * The day whose next digest run can still cover the pick: before the evening
 * run (16:34 UTC) it is the run's own day, after it the pick waits for
 * tomorrow's morning run. Both runs share their UTC calendar date with their
 * Oslo digest day year-round.
 */
export function pickDay(createdAtUtc: string): string {
  const date = createdAtUtc.slice(0, 10);
  return createdAtUtc.slice(11, 16) < "16:34" ? date : daysBefore(date, -1);
}

export interface IssueLike {
  title: string;
  body?: string | null;
  created_at: string;
}

/** Map a `pick:` issue to a pick plus its digest day. */
export function pickFromIssue(issue: IssueLike): Pick & { day: string } {
  const title = issue.title.replace(/^pick:\s*/i, "").trim();
  const body = (issue.body ?? "").trim();
  const fromTitle = URL_RE.exec(title)?.[0];
  const url = fromTitle ?? URL_RE.exec(body)?.[0];
  if (!url) throw new Error("pick issue carries no url in its title or body");
  const rest = (fromTitle ? title.replace(fromTitle, "") : title).trim();
  const note = body.replace(url, "").trim();
  return {
    url,
    ...(rest ? { title: rest } : {}),
    ...(note ? { note } : {}),
    addedAt: issue.created_at,
    day: pickDay(issue.created_at),
  };
}
