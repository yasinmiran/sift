const SITE = "https://sift.yasint.dev";
const GRAPH = "https://graph.instagram.com/v23.0";
const REFRESH_URL = "https://graph.instagram.com/refresh_access_token";
const REFRESH_EVERY_MS = 7 * 24 * 60 * 60 * 1000;
const SLOTS = ["am", "pm"] as const;

interface SlotMeta {
  day: string;
  slot: string;
  caption: string;
  hashtags?: string[];
  cards: { file: string; alt: string }[];
}

type ApiResponse = { id?: string; status_code?: string; access_token?: string };

export interface IgDeps {
  today: () => string;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  /** Kill switch (state blob "ig-paused"): skip posting entirely. */
  paused?: () => Promise<boolean>;
  /** JSON GET of a site url; null on 404. */
  fetchJson: (url: string) => Promise<unknown | null>;
  get: (url: string, params: Record<string, string>) => Promise<ApiResponse>;
  post: (url: string, params: Record<string, string>) => Promise<ApiResponse>;
  state: {
    get: (key: string) => Promise<string | null>;
    set: (key: string, value: string) => Promise<void>;
  };
  env: { userId: string; token: string };
}

// The long-lived token self-renews weekly into the state blob; the env var
// only bootstraps the very first run (dashboard tokens live 60 days).
async function resolveToken(deps: IgDeps): Promise<string> {
  const raw = await deps.state.get("ig-token");
  let current: { token: string; refreshedAt: number };
  try {
    current = raw ? (JSON.parse(raw) as { token: string; refreshedAt: number }) : { token: "", refreshedAt: 0 };
  } catch {
    current = { token: "", refreshedAt: 0 };
  }
  if (!current.token) {
    current = { token: deps.env.token, refreshedAt: deps.now() };
    await deps.state.set("ig-token", JSON.stringify(current));
    return current.token;
  }
  if (deps.now() - current.refreshedAt > REFRESH_EVERY_MS) {
    try {
      const refreshed = await deps.get(REFRESH_URL, {
        grant_type: "ig_refresh_token",
        access_token: current.token,
      });
      if (refreshed.access_token) {
        current = { token: refreshed.access_token, refreshedAt: deps.now() };
        await deps.state.set("ig-token", JSON.stringify(current));
      }
    } catch (err) {
      console.error("ig token refresh failed, keeping the current one", err);
    }
  }
  return current.token;
}

function isSlotMeta(value: unknown, day: string, slot: string): value is SlotMeta {
  const m = value as SlotMeta | null;
  return (
    typeof m === "object" &&
    m !== null &&
    m.day === day &&
    m.slot === slot &&
    typeof m.caption === "string" &&
    m.caption.length > 0 &&
    Array.isArray(m.cards) &&
    m.cards.length > 0 &&
    m.cards.every((c) => typeof c?.file === "string" && typeof c?.alt === "string")
  );
}

async function publishSlot(deps: IgDeps, token: string, day: string, meta: SlotMeta): Promise<void> {
  const base = `${SITE}/slides/${day}/${meta.slot}`;
  // Meta fetches each image server-side (seconds per card); create the
  // child containers concurrently, order preserved by position.
  const children = await Promise.all(
    meta.cards.map(async (card) => {
      const child = await deps.post(`${GRAPH}/${deps.env.userId}/media`, {
        image_url: `${base}/${card.file}`,
        is_carousel_item: "true",
        alt_text: card.alt,
        access_token: token,
      });
      if (!child.id) throw new Error(`no container id for ${card.file}`);
      return child.id;
    }),
  );
  const caption = meta.hashtags?.length ? `${meta.caption}\n\n${meta.hashtags.join(" ")}` : meta.caption;
  const carousel = await deps.post(`${GRAPH}/${deps.env.userId}/media`, {
    media_type: "CAROUSEL",
    children: children.join(","),
    caption,
    access_token: token,
  });
  if (!carousel.id) throw new Error("no carousel container id");
  let status = "";
  for (let attempt = 0; attempt < 10; attempt++) {
    status = (await deps.get(`${GRAPH}/${carousel.id}`, { fields: "status_code", access_token: token })).status_code ?? "";
    if (status === "FINISHED") break;
    if (status === "ERROR") throw new Error(`carousel container ${carousel.id} errored`);
    await deps.sleep(3000);
  }
  if (status !== "FINISHED") throw new Error(`carousel container ${carousel.id} stuck (${status})`);
  await deps.post(`${GRAPH}/${deps.env.userId}/media_publish`, {
    creation_id: carousel.id,
    access_token: token,
  });
}

/**
 * Post today's unposted carousel slots to instagram; idempotent via the
 * "ig-posted" state blob, so the schedule can fire as often as it likes.
 */
export async function runIgPost(
  deps: IgDeps,
): Promise<{ day: string; posted: string[]; failed?: string[]; paused?: true }> {
  const day = deps.today();
  if (await deps.paused?.()) return { day, posted: [], paused: true };
  const token = await resolveToken(deps);
  let posted: { day: string; slots: string[] };
  try {
    const raw = await deps.state.get("ig-posted");
    posted = raw ? (JSON.parse(raw) as { day: string; slots: string[] }) : { day, slots: [] };
  } catch {
    posted = { day, slots: [] };
  }
  if (posted.day !== day) posted = { day, slots: [] };
  const done: string[] = [];
  const failed: string[] = [];
  for (const slot of SLOTS) {
    if (posted.slots.includes(slot)) continue;
    const meta = await deps.fetchJson(`${SITE}/slides/${day}/${slot}/meta.json`);
    if (!isSlotMeta(meta, day, slot)) continue;
    try {
      await publishSlot(deps, token, day, meta);
      posted.slots.push(slot);
      await deps.state.set("ig-posted", JSON.stringify(posted));
      done.push(slot);
    } catch (err) {
      console.error(`ig publish failed for ${day}/${slot}`, err);
      failed.push(slot);
    }
  }
  return failed.length ? { day, posted: done, failed } : { day, posted: done };
}
