import { describe, expect, it } from "vitest";
import { fetchIfChanged } from "../src/fetch";

const stub = (status: number, body = "", headers: Record<string, string> = {}) =>
  async () => ({ statusCode: status, body, headers });

describe("fetchIfChanged", () => {
  it("returns unchanged on 304", async () => {
    const res = await fetchIfChanged("https://x", { etag: '"abc"' }, stub(304) as never);
    expect(res.changed).toBe(false);
  });

  it("returns unchanged when the body hash matches", async () => {
    const first = await fetchIfChanged("https://x", {}, stub(200, "<rss/>") as never);
    expect(first.changed).toBe(true);
    const second = await fetchIfChanged("https://x", first.state, stub(200, "<rss/>") as never);
    expect(second.changed).toBe(false);
  });

  it("captures etag and last-modified for the next poll", async () => {
    const res = await fetchIfChanged(
      "https://x",
      {},
      stub(200, "<rss/>", { etag: '"abc"', "last-modified": "Tue, 30 Jun 2026 00:00:00 GMT" }) as never,
    );
    expect(res.state).toEqual({
      etag: '"abc"',
      lastModified: "Tue, 30 Jun 2026 00:00:00 GMT",
      feedHash: expect.any(String),
    });
  });

  it("throws on http errors", async () => {
    await expect(fetchIfChanged("https://x", {}, stub(500) as never)).rejects.toThrow(/500/);
  });
});
