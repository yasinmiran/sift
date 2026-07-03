import { beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runIngest } from "../src/ingest";
import { today } from "../src/day";
import { loadDay, loadState, saveState } from "../src/store";
import type { SourceConfig } from "../src/sources";

// Fabricated feed with fresh pubDates: the ingest window drops anything older
// than 24h, so recorded fixtures (frozen in June) would come back empty here.
const rssFixture = `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title>
  <item><title>First post</title><guid>a1</guid><link>https://example.com/1</link><pubDate>${new Date().toUTCString()}</pubDate><description>alpha body</description></item>
  <item><title>Second post</title><guid>a2</guid><link>https://example.com/2</link><pubDate>${new Date().toUTCString()}</pubDate><description>beta body</description></item>
  <item><title>Third post</title><guid>a3</guid><link>https://example.com/3</link><pubDate>${new Date().toUTCString()}</pubDate><description>gamma body</description></item>
</channel></rss>`;

const stubFetch = (body: string) => async () => ({ statusCode: 200, body, headers: {} });

const src = (slug = "techmeme", over: Partial<SourceConfig> = {}): SourceConfig => ({
  slug,
  kind: "rss",
  url: "https://feed.example",
  topics: ["startups-industry"],
  enabled: true,
  ...over,
});

let dataDir: string;
beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), "sift-ingest-"));
});

describe("runIngest", () => {
  it("writes today's items file with day, topics and sorted items", async () => {
    const stats = await runIngest(dataDir, { fetchImpl: stubFetch(rssFixture) as never, sources: [src()] });
    expect(stats.created).toBe(3);
    const file = loadDay(dataDir, today());
    expect(file.day).toBe(today());
    expect(file.generatedAt).not.toBe("");
    expect(file.items).toHaveLength(3);
    for (const i of file.items) {
      expect(i.topics).toEqual(["startups-industry"]);
      expect(i.sourceSlug).toBe("techmeme");
    }
  });

  it("skips an unchanged feed on re-run and dedups seen items on a changed one", async () => {
    const sources = [src()];
    await runIngest(dataDir, { fetchImpl: stubFetch(rssFixture) as never, sources });
    const unchanged = await runIngest(dataDir, { fetchImpl: stubFetch(rssFixture) as never, sources });
    expect(unchanged.created).toBe(0);
    expect(unchanged.skipped).toBe(1);
    // Same guids, different body: feed hash changes, seen index must dedup.
    const touched = rssFixture.replace("alpha body", "alpha body edited");
    const reparsed = await runIngest(dataDir, { fetchImpl: stubFetch(touched) as never, sources });
    expect(reparsed.created).toBe(0);
    expect(loadDay(dataDir, today()).items).toHaveLength(3);
  });

  it("merges only new items into an existing day file", async () => {
    const sources = [src()];
    await runIngest(dataDir, { fetchImpl: stubFetch(rssFixture) as never, sources });
    const grown = rssFixture.replace(
      "</channel>",
      `<item><title>Fourth post</title><guid>a4</guid><link>https://example.com/4</link><pubDate>${new Date().toUTCString()}</pubDate><description>delta body</description></item></channel>`,
    );
    const stats = await runIngest(dataDir, { fetchImpl: stubFetch(grown) as never, sources });
    expect(stats.created).toBe(1);
    expect(loadDay(dataDir, today()).items).toHaveLength(4);
  });

  it("drops promotional items and flags paywalled ones", async () => {
    const xml = `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title>
      <item><title>Great tool (Sponsor)</title><guid>s1</guid><pubDate>${new Date().toUTCString()}</pubDate><description>buy it</description></item>
      <item><title>Big scoop</title><guid>s2</guid><link>https://www.wsj.com/tech/big-scoop</link><pubDate>${new Date().toUTCString()}</pubDate><description>news</description></item>
      <item><title>Normal post</title><guid>s3</guid><link>https://example.com/p</link><pubDate>${new Date().toUTCString()}</pubDate><description>fine</description></item>
    </channel></rss>`;
    const stats = await runIngest(dataDir, { fetchImpl: stubFetch(xml) as never, sources: [src("newsletter")] });
    expect(stats.created).toBe(2);
    expect(stats.dropped).toBe(1);
    const items = loadDay(dataDir, today()).items;
    expect(items.map((i) => [i.externalId, i.paywalled]).sort()).toEqual([
      ["s2", true],
      ["s3", false],
    ]);
  });

  it("isolates a failing source and lists it in failures", async () => {
    const fetchImpl = async (url: string) =>
      url.includes("bad")
        ? { statusCode: 500, body: "", headers: {} }
        : { statusCode: 200, body: rssFixture, headers: {} };
    const stats = await runIngest(dataDir, {
      fetchImpl: fetchImpl as never,
      sources: [src("good"), src("bad", { url: "https://bad.example" })],
    });
    expect(stats.created).toBe(3);
    expect(stats.failures).toEqual(["bad"]);
  });

  it("drops items older than the 24h window from a pull-mode adapter", async () => {
    const now = Date.now();
    const freshTime = Math.floor(now / 1000);
    const staleTime = Math.floor((now - 25 * 60 * 60 * 1000) / 1000);
    const hnFetchJson = async (url: string) => {
      if (url.includes("topstories") || url.includes("beststories")) return [1, 2];
      if (url.includes("/item/1")) return { id: 1, type: "story", title: "Fresh story", score: 200, time: freshTime };
      if (url.includes("/item/2")) return { id: 2, type: "story", title: "Stale story", score: 200, time: staleTime };
      if (url.includes("algolia")) return { hits: [] };
      throw new Error("unexpected url " + url);
    };
    const hnSource: SourceConfig = { slug: "hacker-news", kind: "hn", topics: ["ai-llms"], enabled: true };
    const stats = await runIngest(dataDir, { fetchers: { fetchJson: hnFetchJson as never }, sources: [hnSource] });
    expect(stats.created).toBe(1);
    expect(stats.stale).toBe(1);
    const items = loadDay(dataDir, today()).items;
    expect(items).toHaveLength(1);
    expect(items[0]!.title).toBe("Fresh story");
  });

  it("stays quiet on a no-op run: day file and state bytes are unchanged", async () => {
    const sources = [src()];
    await runIngest(dataDir, { fetchImpl: stubFetch(rssFixture) as never, sources });
    const dayPath = join(dataDir, "items", `${today()}.json`);
    const statePath = join(dataDir, "state.json");
    const dayBytesBefore = readFileSync(dayPath, "utf8");
    const stateBytesBefore = readFileSync(statePath, "utf8");
    await runIngest(dataDir, { fetchImpl: stubFetch(rssFixture) as never, sources });
    expect(readFileSync(dayPath, "utf8")).toBe(dayBytesBefore);
    expect(readFileSync(statePath, "utf8")).toBe(stateBytesBefore);
  });

  it("creates an empty day file on a first run that yields zero items", async () => {
    const emptyXml = `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title></channel></rss>`;
    const stats = await runIngest(dataDir, { fetchImpl: stubFetch(emptyXml) as never, sources: [src()] });
    expect(stats.created).toBe(0);
    const file = loadDay(dataDir, today());
    expect(file.items).toEqual([]);
    expect(file.generatedAt).not.toBe("");
  });

  it("sanitizes a non-http(s) item url to null", async () => {
    const xml = `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title>
      <item><title>Bad link</title><guid>x1</guid><link>javascript:alert(1)</link><pubDate>${new Date().toUTCString()}</pubDate><description>body</description></item>
    </channel></rss>`;
    const stats = await runIngest(dataDir, { fetchImpl: stubFetch(xml) as never, sources: [src("newsletter")] });
    expect(stats.created).toBe(1);
    expect(loadDay(dataDir, today()).items[0]!.url).toBeNull();
  });

  it("only fetches enabled sources and prunes stale seen entries", async () => {
    const state = { sources: {}, seen: { "2020-01-01": ["ghost:1"] } };
    saveState(dataDir, state);
    const stats = await runIngest(dataDir, {
      fetchImpl: stubFetch(rssFixture) as never,
      sources: [src("on"), src("off", { enabled: false })],
    });
    expect(stats.sources).toBe(1);
    expect(loadState(dataDir).seen).not.toHaveProperty("2020-01-01");
  });
});
