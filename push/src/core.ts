export interface PushSubscriptionJson {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export function isValidSubscription(body: unknown): body is PushSubscriptionJson {
  if (typeof body !== "object" || body === null) return false;
  const sub = body as Record<string, unknown>;
  if (typeof sub.endpoint !== "string" || !sub.endpoint.startsWith("https://")) return false;
  const keys = sub.keys as Record<string, unknown> | null | undefined;
  return (
    typeof keys === "object" && keys !== null && typeof keys.p256dh === "string" && typeof keys.auth === "string"
  );
}

export function newestDay(sitemapXml: string): string | null {
  const days = [...sitemapXml.matchAll(/(\d{4}-\d{2}-\d{2})\.html/g)].map((m) => m[1]!);
  return days.length ? days.sort().at(-1)! : null;
}

export function pageTitle(html: string): string | null {
  const m = /<title>([^<]*)<\/title>/.exec(html);
  if (!m) return null;
  return m[1]!.trim().replace(/&#39;/g, "'").replace(/&amp;/g, "&");
}

export interface NotifyDeps {
  fetchText: (url: string) => Promise<string>;
  lastNotified: {
    get: () => Promise<string | null>;
    set: (day: string) => Promise<void>;
  };
  subscriptions: {
    list: () => Promise<string[]>;
    get: (key: string) => Promise<PushSubscriptionJson | null>;
    remove: (key: string) => Promise<void>;
  };
  send: (sub: PushSubscriptionJson, payload: string) => Promise<void>;
}

const SITE = "https://sift.yasint.dev";

// State lives in one blob as {day, digest}; a bare day string is the
// pre-hash format and upgrades in place on the next run.
interface NotifyState {
  day: string;
  digest: string | null;
}

function parseState(raw: string | null): NotifyState | null {
  if (raw === null) return null;
  if (!raw.trimStart().startsWith("{")) return { day: raw, digest: null };
  try {
    const p = JSON.parse(raw) as Partial<NotifyState>;
    if (typeof p.day === "string") return { day: p.day, digest: typeof p.digest === "string" ? p.digest : null };
  } catch {
    /* unreadable state reads as first run */
  }
  return null;
}

// The site publishes latest.json with the newest day's digest hash; absent
// on old deploys, in which case only new days notify.
async function latestDigest(deps: NotifyDeps, day: string): Promise<string | null> {
  try {
    const p = JSON.parse(await deps.fetchText(`${SITE}/latest.json`)) as { day?: string; digest?: string };
    return p.day === day && typeof p.digest === "string" ? p.digest : null;
  } catch {
    return null;
  }
}

export async function runNotify(deps: NotifyDeps): Promise<{ day: string | null; sent: number; pruned: number }> {
  const day = newestDay(await deps.fetchText(`${SITE}/sitemap.xml`));
  if (!day) return { day: null, sent: 0, pruned: 0 };
  const digest = await latestDigest(deps, day);
  const record = JSON.stringify({ day, digest });
  const state = parseState(await deps.lastNotified.get());
  if (state === null) {
    // first run: record the current state so an old digest never notifies late
    await deps.lastNotified.set(record);
    return { day, sent: 0, pruned: 0 };
  }
  const newDay = day > state.day;
  const rewritten = day === state.day && digest !== null && state.digest !== null && digest !== state.digest;
  if (!newDay && !rewritten) {
    // upgrade day-only state with the hash without notifying anyone
    if (day === state.day && digest !== null && state.digest === null) await deps.lastNotified.set(record);
    return { day, sent: 0, pruned: 0 };
  }
  const title = pageTitle(await deps.fetchText(`${SITE}/${day}.html`)) ?? "a new digest is up";
  const payload = JSON.stringify({
    title: "sift",
    body: newDay ? title : `${title} (updated)`,
    url: `/${day}.html`,
  });
  let sent = 0;
  let pruned = 0;
  for (const key of await deps.subscriptions.list()) {
    const sub = await deps.subscriptions.get(key);
    if (!sub) continue;
    try {
      await deps.send(sub, payload);
      sent++;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await deps.subscriptions.remove(key);
        pruned++;
      } else {
        console.error(`push send failed (${status ?? "?"}) for ${key}`, err);
      }
    }
  }
  await deps.lastNotified.set(record);
  return { day, sent, pruned };
}
