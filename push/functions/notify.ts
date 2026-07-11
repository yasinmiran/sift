import { getStore } from "@netlify/blobs";
import webpush from "web-push";
import { runNotify, type PushSubscriptionJson } from "../src/core";

export default async (): Promise<void> => {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  const subs = getStore("subs");
  const state = getStore("state");
  const result = await runNotify({
    fetchText: async (url) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} on ${url}`);
      return res.text();
    },
    paused: async () => ["1", "true"].includes(((await state.get("paused", { type: "text" })) ?? "").trim()),
    lastNotified: {
      get: () => state.get("last-notified", { type: "text" }),
      set: async (day) => { await state.set("last-notified", day); },
    },
    subscriptions: {
      list: async () => (await subs.list()).blobs.map((b) => b.key),
      get: (key) => subs.get(key, { type: "json" }) as Promise<PushSubscriptionJson | null>,
      remove: (key) => subs.delete(key),
    },
    send: async (sub, payload) => {
      await webpush.sendNotification(sub, payload);
    },
  });
  console.log(JSON.stringify(result));
};

export const config = { schedule: "*/15 * * * *" };
