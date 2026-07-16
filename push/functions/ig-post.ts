import { getStore } from "@netlify/blobs";
import { runIgPost } from "../src/ig";

async function igCall(
  method: "GET" | "POST",
  url: string,
  params: Record<string, string>,
): Promise<{ id?: string; status_code?: string; access_token?: string }> {
  const query = new URLSearchParams(params);
  const res = await fetch(method === "GET" ? `${url}?${query}` : url, {
    method,
    ...(method === "POST" ? { body: query } : {}),
  });
  const body = (await res.json()) as { error?: { message?: string } } & Record<string, unknown>;
  if (!res.ok) throw new Error(`${res.status} on ${url.split("?")[0]}: ${body.error?.message ?? "unknown"}`);
  return body as { id?: string; status_code?: string; access_token?: string };
}

export default async (): Promise<void> => {
  const state = getStore("state");
  const result = await runIgPost({
    today: () => new Date().toISOString().slice(0, 10),
    now: () => Date.now(),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    paused: async () => ["1", "true"].includes(((await state.get("ig-paused", { type: "text" })) ?? "").trim()),
    fetchJson: async (url) => {
      const res = await fetch(url);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`${res.status} on ${url}`);
      return res.json();
    },
    get: (url, params) => igCall("GET", url, params),
    post: (url, params) => igCall("POST", url, params),
    state: {
      get: (key) => state.get(key, { type: "text" }),
      set: async (key, value) => {
        await state.set(key, value);
      },
    },
    env: { userId: process.env.IG_USER_ID!, token: process.env.IG_ACCESS_TOKEN! },
  });
  console.log(JSON.stringify(result));
};

export const config = { schedule: "*/15 4-6,16-18 * * *" };
