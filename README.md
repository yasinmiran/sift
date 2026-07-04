# sift

Personal daily tech digest, fully serverless: a GitHub Action fetches
curated sources twice a day and commits the items as JSON, a scheduled
Claude agent reads them and commits a markdown digest, and GitHub Pages
renders the digests to [sift.yasint.dev](https://sift.yasint.dev). The
repo is the whole system: no server, no database, no credentials.

## Architecture

Three actors, all meeting in this repo's git history:

```
config/sources.json
        |
        v
[ingest Action]  cron 03:15 + 15:45 UTC          .github/workflows/ingest.yml
   fetch -> parse -> filter -> dedupe
        |
        v
data/items/{day}.json + data/state.json          committed
        |
        v
[Claude agent]  06:00 + 18:30 Europe/Oslo        contract: AGENTS.md
   read items -> read articles -> write -> verify
        |
        v
digests/{day}.md                                 committed
        |
        v
[pages Action]  on push to digests/, src/        .github/workflows/pages.yml
   src/site.ts renders markdown -> html
        |
        v
https://sift.yasint.dev
```

Each stage only reads what the previous one committed, so every stage
can be re-run, inspected, or replayed from history independently.

## The ingest pipeline

`npm run ingest` (src/ingest.ts) makes one pass over the enabled
sources in `config/sources.json`:

1. **Fetch.** Feed sources go through `src/fetch.ts`: conditional GET
   with ETag, then Last-Modified, then a body hash for feeds that send
   neither. An unchanged feed costs one request and no parse. Sources
   that need their own fetching (HN's JSON API, newsletter archive
   pages) pull for themselves.
2. **Parse.** The adapter for the source's `kind` maps the payload to
   plain items (src/adapters/): `rss` for feeds, `arxiv` for arXiv's
   announce-typed category feeds (only announce type "new" is news),
   `hn` for the Algolia front page plus a high-score backfill, and
   `web` for per-site HTML extractors.
3. **Filter.** Items older than 24h are dropped (feeds replay old
   entries; the digest only wants today). `src/classify.ts` drops
   sponsored inventory and flags paywalled domains and subscriber-only
   stubs so the digest can prefer links readers can open.
4. **Dedupe.** Item identity is `sourceSlug:externalId`. The seen index
   in `data/state.json` remembers identities for 7 days, so nothing
   re-enters a later day.
5. **Store.** Survivors append to `data/items/{day}.json`. Day is the
   calendar date in Europe/Oslo (src/day.ts), never the server's zone.
   `npm run cleanup` then prunes items and digests older than a month;
   git history keeps everything.

The Action commits whatever changed. Runs are idempotent: unchanged
feeds are skipped, seen items never duplicate, and quiet runs commit
nothing.

## The digest

A scheduled Claude agent (its full contract lives in `AGENTS.md`) reads
the day's items, fetches and reads the underlying articles, and commits
`digests/{day}.md`: ~15 entries with inline links, a Threads section
mapping how the stories relate, and no repeats of stories a previous
day already covered. The morning run writes the day's first digest; the
evening run rewrites it with the full day.

`npm run verify -- {day}` (src/verify.ts) is the agent's self-check
before committing: frontmatter shape, links against the day's items,
links against earlier digests (repeat detection), em/en dashes, and the
Threads section. Errors exit non-zero; warnings need judgment.

## The site

`npm run site` (src/site.ts) renders `digests/` into `site/`: one page
per day, an index, sitemap, robots.txt, and a 404 page that tells
visitors when a not-yet-written digest lands. The pages workflow
deploys it on every push that touches digests or the renderer. The
design tokens mirror yasint.dev (see contract below).

## Data contracts

```
data/items/{day}.json   { day, generatedAt, items: [ { sourceSlug,
                          externalId, title, url, author, publishedAt,
                          content, topics[], paywalled, mediaType } ] }
data/state.json         { sources: { slug: { etag, lastModified,
                          feedHash } }, seen: { day: [keys] } }
digests/{day}.md        ---\ntitle, description, date\n--- + markdown
```

## Source layout

```
src/day.ts         the one canonical "day": Oslo calendar date
src/sources.ts     config loader + validation
src/fetch.ts       conditional GET with retry
src/classify.ts    promo drop + paywall flag
src/store.ts       day files, state, seen index
src/ingest.ts      the pipeline pass (CLI: npm run ingest)
src/cleanup.ts     rolling-month pruning (CLI: npm run cleanup)
src/frontmatter.ts digest file format, shared by verify + site
src/verify.ts      digest self-check (CLI: npm run verify -- {day})
src/site.ts        static site renderer (CLI: npm run site)
src/log.ts         one-line JSON logs
src/adapters/      registry + rss / arxiv / hn / web (+ extractors)
```

Tests (`npm test`) are vitest against fixtures, never the network;
`npm run ingest` outside tests is the only live caller.

## yasint.dev contract

This site pairs with [yasint.dev](https://yasint.dev) (separate, private
repo). The handshake both sides rely on, pinned by
`test/contract.test.ts` here and `tests/sift-contract.test.ts` there:

- yasint.dev links here with `?from=<path>`; every page stashes it and
  upgrades the `data-backlink` byline to return the visitor to that page.
- Its callout links `/?today=1`; the index jumps to today's digest when
  it exists, otherwise reports the next drop (06:00 / 18:30 Oslo).
- The design tokens in `src/site.ts` mirror yasint.dev's
  `tailwind.config.mjs` (the canonical copy) and its `global.css`
  substrate. Retune there first, then sync here and update both tests.
