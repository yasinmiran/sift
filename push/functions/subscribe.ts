import { getStore } from "@netlify/blobs";
import { createHash } from "node:crypto";
import { isValidSubscription } from "../src/core";

export interface SubsStore {
  setJSON: (key: string, value: unknown) => Promise<unknown>;
  delete: (key: string) => Promise<void>;
}

const CORS = {
  "access-control-allow-origin": "https://sift.yasint.dev",
  "access-control-allow-methods": "POST, DELETE, OPTIONS",
  "access-control-allow-headers": "content-type",
};

const reply = (status: number) => new Response(null, { status, headers: CORS });

export async function handleSubscribe(req: Request, store: SubsStore): Promise<Response> {
  if (req.method === "OPTIONS") return reply(204);
  if (req.method !== "POST" && req.method !== "DELETE") return reply(405);
  const text = await req.text();
  if (text.length > 4096) return reply(413);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return reply(400);
  }
  const endpoint = (body as { endpoint?: unknown } | null)?.endpoint;
  if (typeof endpoint !== "string") return reply(400);
  const key = createHash("sha256").update(endpoint).digest("hex");
  if (req.method === "DELETE") {
    await store.delete(key);
    return reply(204);
  }
  if (!isValidSubscription(body)) return reply(400);
  await store.setJSON(key, body);
  return reply(201);
}

export default (req: Request): Promise<Response> => handleSubscribe(req, getStore("subs"));

export const config = { path: "/subscribe" };
