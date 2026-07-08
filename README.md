# sift

Personal daily tech digest, fully serverless: a GitHub Action ingests
curated sources twice a day and commits the items as JSON, a scheduled
Claude agent turns them into a markdown digest, and GitHub Pages serves
the result at [sift.yasint.dev](https://sift.yasint.dev). The repo is
the whole system: no server, no database, no credentials.

## Architecture

Three actors, meeting only in this repo's git history:

```
config/sources.json
        |
        v
[ingest Action]  cron 03:15 + 15:45 UTC       .github/workflows/ingest.yml
   fetch -> parse -> filter -> dedupe
        |
        v
data/items/{day}.json + data/state.json       committed
        |
        v
[Claude agent]   cron 04:34 + 16:34 UTC       contract: AGENTS.md
   read items -> read articles -> write -> verify
        |
        v
digests/{day}.md                              committed
        |
        v
[pages Action]   on push                      .github/workflows/pages.yml
   render markdown -> static html
        |
        v
https://sift.yasint.dev
```

Each stage reads only what the previous one committed, so every stage
can be re-run, inspected, or replayed from history independently.

## Ingest

`npm run ingest` (src/pipeline/) makes one pass over the enabled
sources in `config/sources.json`:

1. **Fetch**: conditional GET (ETag, then Last-Modified, then a body
   hash); an unchanged feed costs one request and no parse.
2. **Parse**: per-kind adapters (`rss`, `arxiv`, `hn`, `web`) map the
   payload to plain items.
3. **Filter**: drop items older than 24h and sponsored inventory; flag
   paywalled links so the digest can prefer ones readers can open.
4. **Dedupe**: item identity is `sourceSlug:externalId`, remembered for
   7 days in `data/state.json`.
5. **Store**: survivors append to `data/items/{day}.json`; day is the
   Europe/Oslo calendar date, never the server's zone.

Runs are idempotent and quiet runs commit nothing. `npm run cleanup`
prunes items and digests older than a month; git history keeps
everything.

## Digest

A scheduled Claude agent (full contract in `AGENTS.md`) reads the day's
items, fetches and reads the underlying articles, and commits
`digests/{day}.md`: ~15 entries with inline links and a Threads section
mapping how the stories relate. The morning run writes the day's first
half; the evening run rewrites it with the full day.
`npm run verify -- {day}` is the agent's self-check before committing:
frontmatter shape, link validity, and repeat detection against earlier
digests.

## Site

`npm run site` (src/site/) renders `digests/` into a static site: one
page per day, an index featuring the newest day, sitemap, and a
day-aware 404. It is an installable PWA with push notifications: the
service worker handles push only (no offline), and a small Netlify
sidecar (`push/`) stores subscriptions in Netlify Blobs, polls the
sitemap on a 15-minute schedule, and fans out a web push when a new day
appears. The site never calls the sidecar except to subscribe.

## Data contracts

```
data/items/{day}.json   { day, generatedAt, items: [ { sourceSlug,
                          externalId, title, url, author, publishedAt,
                          content, topics[], paywalled, mediaType } ] }
data/state.json         { sources: { slug: { etag, lastModified,
                          feedHash } }, seen: { day: [keys] } }
data/picks/{day}.json   { day, summary, items: [ { url, title, note,
                          addedAt } ] }   hand-found links, recorded
                          with `npm run pick -- <url> [note]`
digests/{day}.md        ---\ntitle, description, date\n--- + markdown
```

Tests (`npm test`) are vitest against fixtures, never the network. The
design tokens and the byline backlink pair with
[yasint.dev](https://yasint.dev); that handshake is pinned by
`test/contract.test.ts`.
