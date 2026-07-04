// Polite feed fetching with three tiers of change detection: ETag, then
// Last-Modified, then a body hash for the many feeds that send neither
// validator (or ignore them). An unchanged feed costs one request and no
// parse; the validators round-trip through data/state.json between runs.
import { createHash } from "node:crypto";
import { withRetry } from "./retry";

const sha256 = (s: string): string => createHash("sha256").update(s).digest("hex");

export interface FeedState {
  etag?: string | null;
  lastModified?: string | null;
  feedHash?: string | null;
}

export interface FetchOutcome {
  changed: boolean;
  body?: string;
  state: { etag: string | null; lastModified: string | null; feedHash: string | null };
}

type MinimalResponse = {
  statusCode: number;
  body: string;
  headers: Record<string, string | undefined>;
};
export type FetchImpl = (url: string, headers: Record<string, string>) => Promise<MinimalResponse>;

const liveFetch: FetchImpl = async (url, headers) => {
  const res = await fetch(url, {
    headers: { "user-agent": "sift/1.0", ...headers },
    redirect: "follow",
    signal: AbortSignal.timeout(20_000),
  });
  return {
    statusCode: res.status,
    body: res.status === 304 ? "" : await res.text(),
    headers: {
      etag: res.headers.get("etag") ?? undefined,
      "last-modified": res.headers.get("last-modified") ?? undefined,
    },
  };
};

export async function fetchIfChanged(
  url: string,
  prev: FeedState,
  fetchImpl: FetchImpl = liveFetch,
): Promise<FetchOutcome> {
  const headers: Record<string, string> = {};
  if (prev.etag) headers["if-none-match"] = prev.etag;
  if (prev.lastModified) headers["if-modified-since"] = prev.lastModified;

  // 403/415/429 come from edge/WAF hiccups often enough (css-tricks served a
  // one-off 415) that they earn the same single retry as a 5xx; real client
  // errors (404, 410) stay fatal on first sight.
  const TRANSIENT_4XX = new Set([403, 408, 415, 429]);
  const res = await withRetry(async () => {
    const r = await fetchImpl(url, headers);
    if (r.statusCode >= 500 || TRANSIENT_4XX.has(r.statusCode)) {
      throw new Error(`fetch ${url} failed: ${r.statusCode}`);
    }
    return r;
  });
  if (res.statusCode === 304) {
    return {
      changed: false,
      state: {
        etag: prev.etag ?? null,
        lastModified: prev.lastModified ?? null,
        feedHash: prev.feedHash ?? null,
      },
    };
  }
  if (res.statusCode >= 400) throw new Error(`fetch ${url} failed: ${res.statusCode}`);

  const feedHash = sha256(res.body);
  const state = {
    etag: res.headers.etag ?? null,
    lastModified: res.headers["last-modified"] ?? null,
    feedHash,
  };
  if (prev.feedHash && prev.feedHash === feedHash) return { changed: false, state };
  return { changed: true, body: res.body, state };
}
