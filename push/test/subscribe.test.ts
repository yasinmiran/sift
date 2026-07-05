import { describe, expect, it } from "vitest";
import { handleSubscribe, type SubsStore } from "../functions/subscribe";

function fakeStore(): SubsStore & { data: Record<string, unknown> } {
  const data: Record<string, unknown> = {};
  return {
    data,
    setJSON: async (key, value) => { data[key] = value; },
    delete: async (key) => { delete data[key]; },
  };
}

const good = { endpoint: "https://push.example/1", keys: { p256dh: "p", auth: "a" } };
const post = (body: unknown) =>
  new Request("https://x/subscribe", { method: "POST", body: JSON.stringify(body) });

describe("handleSubscribe", () => {
  it("answers preflight with cors for the site origin", async () => {
    const res = await handleSubscribe(new Request("https://x/subscribe", { method: "OPTIONS" }), fakeStore());
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("https://sift.yasint.dev");
  });

  it("stores a valid subscription keyed by endpoint hash", async () => {
    const store = fakeStore();
    const res = await handleSubscribe(post(good), store);
    expect(res.status).toBe(201);
    expect(Object.values(store.data)).toEqual([good]);
    const key = Object.keys(store.data)[0]!;
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rejects invalid bodies", async () => {
    const store = fakeStore();
    expect((await handleSubscribe(post({ endpoint: "http://x" }), store)).status).toBe(400);
    expect((await handleSubscribe(new Request("https://x/subscribe", { method: "POST", body: "not json" }), store)).status).toBe(400);
    expect(Object.keys(store.data)).toEqual([]);
  });

  it("rejects oversized bodies", async () => {
    const res = await handleSubscribe(post({ ...good, pad: "x".repeat(5000) }), fakeStore());
    expect(res.status).toBe(413);
  });

  it("deletes by endpoint", async () => {
    const store = fakeStore();
    await handleSubscribe(post(good), store);
    const res = await handleSubscribe(
      new Request("https://x/subscribe", { method: "DELETE", body: JSON.stringify({ endpoint: good.endpoint }) }),
      store,
    );
    expect(res.status).toBe(204);
    expect(Object.keys(store.data)).toEqual([]);
  });

  it("rejects other methods", async () => {
    expect((await handleSubscribe(new Request("https://x/subscribe", { method: "GET" }), fakeStore())).status).toBe(405);
  });
});
