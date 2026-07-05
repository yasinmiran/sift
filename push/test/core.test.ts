import { describe, expect, it } from "vitest";
import {
  isValidSubscription,
  newestDay,
  pageTitle,
  runNotify,
  type NotifyDeps,
  type PushSubscriptionJson,
} from "../src/core";

const sub = (endpoint: string): PushSubscriptionJson => ({
  endpoint,
  keys: { p256dh: "p", auth: "a" },
});

const SITEMAP = `<?xml version="1.0"?><urlset>
<url><loc>https://sift.yasint.dev/</loc></url>
<url><loc>https://sift.yasint.dev/2026-07-04.html</loc></url>
<url><loc>https://sift.yasint.dev/2026-07-05.html</loc></url>
</urlset>`;

function fakeDeps(overrides: Partial<{ last: string | null; subs: Record<string, PushSubscriptionJson>; failWith: Record<string, number> }> = {}) {
  const store: Record<string, PushSubscriptionJson> = { ...(overrides.subs ?? { k1: sub("https://push.example/1") }) };
  const failWith = overrides.failWith ?? {};
  const state = { last: overrides.last ?? null as string | null };
  const sent: string[] = [];
  const deps: NotifyDeps = {
    fetchText: async (url) =>
      url.endsWith("sitemap.xml") ? SITEMAP : "<html><head><title>The day&#39;s tech, sifted: Jul 05, 2026</title></head></html>",
    lastNotified: {
      get: async () => state.last,
      set: async (day) => { state.last = day; },
    },
    subscriptions: {
      list: async () => Object.keys(store),
      get: async (key) => store[key] ?? null,
      remove: async (key) => { delete store[key]; },
    },
    send: async (s, payload) => {
      const status = failWith[s.endpoint];
      if (status) throw Object.assign(new Error("push failed"), { statusCode: status });
      sent.push(payload);
    },
  };
  return { deps, state, store, sent };
}

describe("isValidSubscription", () => {
  it("accepts a real-shaped subscription", () => {
    expect(isValidSubscription(sub("https://push.example/x"))).toBe(true);
  });
  it("rejects junk, http endpoints and missing keys", () => {
    expect(isValidSubscription(null)).toBe(false);
    expect(isValidSubscription({ endpoint: "http://x", keys: { p256dh: "p", auth: "a" } })).toBe(false);
    expect(isValidSubscription({ endpoint: "https://x" })).toBe(false);
    expect(isValidSubscription({ endpoint: "https://x", keys: { p256dh: "p" } })).toBe(false);
  });
});

describe("newestDay / pageTitle", () => {
  it("finds the newest day in a sitemap", () => {
    expect(newestDay(SITEMAP)).toBe("2026-07-05");
    expect(newestDay("<urlset></urlset>")).toBeNull();
  });
  it("extracts the page title", () => {
    expect(pageTitle("<title>hello</title>")).toBe("hello");
    expect(pageTitle("<html></html>")).toBeNull();
  });
});

describe("runNotify", () => {
  it("records without sending on first ever run", async () => {
    const { deps, state, sent } = fakeDeps({ last: null });
    const r = await runNotify(deps);
    expect(r).toEqual({ day: "2026-07-05", sent: 0, pruned: 0 });
    expect(state.last).toBe("2026-07-05");
    expect(sent).toEqual([]);
  });

  it("does nothing when the newest day was already notified", async () => {
    const { deps, sent } = fakeDeps({ last: "2026-07-05" });
    const r = await runNotify(deps);
    expect(r.sent).toBe(0);
    expect(sent).toEqual([]);
  });

  it("sends to every subscription on a new day and records it", async () => {
    const { deps, state, sent } = fakeDeps({
      last: "2026-07-04",
      subs: { k1: sub("https://push.example/1"), k2: sub("https://push.example/2") },
    });
    const r = await runNotify(deps);
    expect(r).toEqual({ day: "2026-07-05", sent: 2, pruned: 0 });
    expect(state.last).toBe("2026-07-05");
    const payload = JSON.parse(sent[0]!);
    expect(payload).toEqual({ title: "sift", body: "The day's tech, sifted: Jul 05, 2026", url: "/2026-07-05.html" });
  });

  it("prunes gone subscriptions and keeps sending to the rest", async () => {
    const { deps, store } = fakeDeps({
      last: "2026-07-04",
      subs: { k1: sub("https://push.example/dead"), k2: sub("https://push.example/live") },
      failWith: { "https://push.example/dead": 410 },
    });
    const r = await runNotify(deps);
    expect(r).toEqual({ day: "2026-07-05", sent: 1, pruned: 1 });
    expect(Object.keys(store)).toEqual(["k2"]);
  });

  it("keeps subscriptions on non-gone send errors", async () => {
    const { deps, store } = fakeDeps({
      last: "2026-07-04",
      subs: { k1: sub("https://push.example/flaky") },
      failWith: { "https://push.example/flaky": 500 },
    });
    const r = await runNotify(deps);
    expect(r).toEqual({ day: "2026-07-05", sent: 0, pruned: 0 });
    expect(Object.keys(store)).toEqual(["k1"]);
  });
});
