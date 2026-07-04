import { describe, expect, it } from "vitest";
import { fetchIfChanged } from "../src/pipeline/fetch";

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

  it("retries once on a thrown transient failure", async () => {
    let calls = 0;
    const flaky = async () => {
      calls++;
      if (calls === 1) throw new Error("socket hang up");
      return { statusCode: 200, body: "<rss/>", headers: {} };
    };
    const res = await fetchIfChanged("https://x", {}, flaky as never);
    expect(res.changed).toBe(true);
    expect(calls).toBe(2);
  });

  it("retries once on a 5xx and throws if it persists", async () => {
    let calls = 0;
    const dying = async () => {
      calls++;
      return { statusCode: 503, body: "", headers: {} };
    };
    await expect(fetchIfChanged("https://x", {}, dying as never)).rejects.toThrow(/503/);
    expect(calls).toBe(2);
  });

  it("does not retry client errors", async () => {
    let calls = 0;
    const gone = async () => {
      calls++;
      return { statusCode: 404, body: "", headers: {} };
    };
    await expect(fetchIfChanged("https://x", {}, gone as never)).rejects.toThrow(/404/);
    expect(calls).toBe(1);
  });
});
