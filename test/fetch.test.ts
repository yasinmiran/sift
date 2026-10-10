import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { fetchIfChanged, USER_AGENT } from "../src/pipeline/fetch";

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

  it("retries once on a transient edge 4xx (403/415/429) and succeeds", async () => {
    for (const status of [403, 415, 429]) {
      let calls = 0;
      const flaky = async () => {
        calls++;
        return calls === 1
          ? { statusCode: status, body: "", headers: {} }
          : { statusCode: 200, body: "<rss/>", headers: {} };
      };
      const res = await fetchIfChanged("https://x", {}, flaky as never);
      expect(res.changed).toBe(true);
      expect(calls).toBe(2);
    }
  });
});

// Every live fetcher is module-private on purpose (tests inject stubs, and a
// stub never sees these headers), so the identity sift sends has no runtime
// surface a test can read. The source does: the rule is that a file calling
// the global fetch sends USER_AGENT and nothing else, which is also what the
// field playbook asks for ("never impersonate a browser or evade a block").
const BROWSER = /Mozilla|AppleWebKit|Chrome\/|Safari\/|Gecko/;

function pipelineSources(): { file: string; src: string }[] {
  const root = join(__dirname, "../src/pipeline");
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(join(dir, e.name)) : e.name.endsWith(".ts") ? [join(dir, e.name)] : [],
    );
  return walk(root).map((file) => ({ file: relative(root, file), src: readFileSync(file, "utf8") }));
}

describe("the pipeline's user agent", () => {
  it("names sift and carries a url an operator can read", () => {
    expect(USER_AGENT).toMatch(/^sift\/\d/);
    expect(USER_AGENT).toContain("(+https://sift.yasint.dev)");
    expect(USER_AGENT).not.toMatch(BROWSER);
  });

  it("is the only identity any live fetch sends", () => {
    const callers = pipelineSources().filter(({ src }) => /\bawait fetch\(/.test(src));
    expect(callers.map((c) => c.file).sort()).toEqual([
      "adapters/hn.ts",
      "adapters/web.ts",
      "fetch.ts",
    ]);
    for (const { file, src } of callers) {
      expect(src, `${file}: a live fetch must send the shared USER_AGENT`).toContain(
        '"user-agent": USER_AGENT',
      );
      expect(src, `${file}: never impersonate a browser (AGENTS.md field playbook)`).not.toMatch(
        BROWSER,
      );
    }
  });
});
