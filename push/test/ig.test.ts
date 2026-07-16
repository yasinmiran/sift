import { describe, expect, it } from "vitest";
import { runIgPost, type IgDeps } from "../src/ig";

const DAY = "2026-07-16";
const WEEK = 7 * 24 * 60 * 60 * 1000;

const meta = (slot: string, cards = 2) => ({
  day: DAY,
  slot,
  caption: `the day, sifted. full digest at sift.yasint.dev (link in bio)`,
  hashtags: ["#tech", "#ai"],
  cards: Array.from({ length: cards }, (_, i) => ({ file: `card-${i + 1}.png`, alt: `alt ${i + 1}` })),
});

function fakeDeps(
  overrides: Partial<{
    metas: Record<string, unknown>;
    posted: string | null;
    tokenBlob: string | null;
    paused: boolean;
    failPublishFor: string[];
    failChildrenFor: string[];
    refreshFails: boolean;
  }> = {},
) {
  const state: Record<string, string> = {};
  if (overrides.posted) state["ig-posted"] = overrides.posted;
  if (overrides.tokenBlob) state["ig-token"] = overrides.tokenBlob;
  const calls: { method: string; url: string; params: Record<string, string> }[] = [];
  let nextId = 100;
  const deps: IgDeps = {
    today: () => DAY,
    now: () => 1_000_000_000_000,
    sleep: async () => {},
    paused: async () => overrides.paused ?? false,
    fetchJson: async (url) => {
      const slot = /\/(am|pm)\/meta\.json$/.exec(url)?.[1];
      return (slot && overrides.metas?.[slot]) ?? null;
    },
    get: async (url, params) => {
      calls.push({ method: "GET", url, params });
      if (url.includes("refresh_access_token")) {
        if (overrides.refreshFails) throw new Error("token too young");
        return { access_token: "refreshed-token", expires_in: 5183944 };
      }
      return { status_code: "FINISHED" };
    },
    post: async (url, params) => {
      calls.push({ method: "POST", url, params });
      if (url.endsWith("/media_publish") && overrides.failPublishFor?.some((id) => params.creation_id === id)) {
        throw new Error("publish failed");
      }
      if (
        params.is_carousel_item === "true" &&
        overrides.failChildrenFor?.some((slot) => params.image_url?.includes(`/${slot}/`))
      ) {
        throw new Error("image fetch failed");
      }
      return { id: String(nextId++) };
    },
    state: {
      get: async (key) => state[key] ?? null,
      set: async (key, value) => {
        state[key] = value;
      },
    },
    env: { userId: "IGUSER", token: "env-token" },
  };
  return { deps, state, calls };
}

describe("runIgPost", () => {
  it("publishes a fresh slot as a carousel with alt texts and records it", async () => {
    const { deps, state, calls } = fakeDeps({ metas: { am: meta("am") } });
    const r = await runIgPost(deps);
    expect(r.posted).toEqual(["am"]);
    const children = calls.filter((c) => c.method === "POST" && c.params.is_carousel_item === "true");
    expect(children).toHaveLength(2);
    expect(children[0]!.params.image_url).toBe("https://sift.yasint.dev/slides/2026-07-16/am/card-1.png");
    expect(children[0]!.params.alt_text).toBe("alt 1");
    const carousel = calls.find((c) => c.params.media_type === "CAROUSEL")!;
    expect(carousel.params.children).toBe("100,101");
    expect(carousel.params.caption).toBe(
      "the day, sifted. full digest at sift.yasint.dev (link in bio)\n\n#tech #ai",
    );
    const publish = calls.find((c) => c.url.endsWith("/media_publish"))!;
    expect(publish.params.creation_id).toBe("102");
    expect(JSON.parse(state["ig-posted"]!)).toEqual({ day: DAY, slots: ["am"] });
  });

  it("skips already-posted slots and missing metas, resets state on a new day", async () => {
    const both = fakeDeps({
      metas: { am: meta("am"), pm: meta("pm") },
      posted: JSON.stringify({ day: DAY, slots: ["am"] }),
    });
    expect((await runIgPost(both.deps)).posted).toEqual(["pm"]);
    const stale = fakeDeps({
      metas: { am: meta("am") },
      posted: JSON.stringify({ day: "2026-07-15", slots: ["am", "pm"] }),
    });
    expect((await runIgPost(stale.deps)).posted).toEqual(["am"]);
    const none = fakeDeps({ metas: {} });
    const r = await runIgPost(none.deps);
    expect(r.posted).toEqual([]);
    expect(none.calls.filter((c) => c.method === "POST")).toHaveLength(0);
  });

  it("rejects a meta whose day or slot does not match its address", async () => {
    const { deps, calls } = fakeDeps({ metas: { am: { ...meta("am"), day: "2026-07-15" } } });
    expect((await runIgPost(deps)).posted).toEqual([]);
    expect(calls.filter((c) => c.method === "POST")).toHaveLength(0);
  });

  it("does nothing while paused and records nothing", async () => {
    const { deps, state, calls } = fakeDeps({ metas: { am: meta("am") }, paused: true });
    const r = await runIgPost(deps);
    expect(r.paused).toBe(true);
    expect(r.posted).toEqual([]);
    expect(calls).toHaveLength(0);
    expect(state["ig-posted"]).toBeUndefined();
  });

  it("claims a slot before publishing so a crashed publish can never double-post", async () => {
    const { deps, state } = fakeDeps({
      metas: { am: meta("am"), pm: meta("pm") },
      failPublishFor: ["102"],
    });
    const r = await runIgPost(deps);
    expect(r.posted).toEqual(["pm"]);
    expect(r.failed).toEqual(["am (claimed, needs manual review)"]);
    expect(JSON.parse(state["ig-posted"]!)).toEqual({ day: DAY, slots: ["am", "pm"] });
  });

  it("leaves a slot unclaimed and retryable when container creation fails before the claim", async () => {
    const { deps, state } = fakeDeps({
      metas: { am: meta("am"), pm: meta("pm") },
      failChildrenFor: ["am"],
    });
    const r = await runIgPost(deps);
    expect(r.posted).toEqual(["pm"]);
    expect(r.failed).toEqual(["am"]);
    expect(JSON.parse(state["ig-posted"]!)).toEqual({ day: DAY, slots: ["pm"] });
  });

  it("bootstraps the token blob from env, then refreshes it once a week", async () => {
    const boot = fakeDeps({ metas: {} });
    await runIgPost(boot.deps);
    expect(JSON.parse(boot.state["ig-token"]!)).toEqual({ token: "env-token", refreshedAt: 1_000_000_000_000 });
    expect(boot.calls.some((c) => c.url.includes("refresh_access_token"))).toBe(false);
    const stale = fakeDeps({
      metas: { am: meta("am") },
      tokenBlob: JSON.stringify({ token: "old-token", refreshedAt: 1_000_000_000_000 - WEEK - 1 }),
    });
    await runIgPost(stale.deps);
    expect(JSON.parse(stale.state["ig-token"]!)).toEqual({ token: "refreshed-token", refreshedAt: 1_000_000_000_000 });
    const posts = stale.calls.filter((c) => c.method === "POST");
    expect(posts.every((c) => c.params.access_token === "refreshed-token")).toBe(true);
  });

  it("keeps the current token when the refresh fails", async () => {
    const { deps, state, calls } = fakeDeps({
      metas: { am: meta("am") },
      tokenBlob: JSON.stringify({ token: "old-token", refreshedAt: 1_000_000_000_000 - WEEK - 1 }),
      refreshFails: true,
    });
    const r = await runIgPost(deps);
    expect(r.posted).toEqual(["am"]);
    expect(JSON.parse(state["ig-token"]!).token).toBe("old-token");
    expect(calls.filter((c) => c.method === "POST").every((c) => c.params.access_token === "old-token")).toBe(true);
  });
});
