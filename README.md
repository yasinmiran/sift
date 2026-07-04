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
   src/site/ renders markdown -> html
        |
        v
https://sift.yasint.dev
```

Each stage only reads what the previous one committed, so every stage
can be re-run, inspected, or replayed from history independently.

## The ingest pipeline

`npm run ingest` (src/pipeline/) makes one pass over the enabled
sources in `config/sources.json`:

1. **Fetch.** Feed sources go through `fetch.ts`: conditional GET
   with ETag, then Last-Modified, then a body hash for feeds that send
   neither. An unchanged feed costs one request and no parse. Sources
   that need their own fetching (HN's JSON API, newsletter archive
   pages) pull for themselves.
2. **Parse.** The adapter for the source's `kind` maps the payload to
   plain items (adapters/): `rss` for feeds, `arxiv` for arXiv's
   announce-typed category feeds (only announce type "new" is news),
   `hn` for the Algolia front page plus a high-score backfill, and
   `web` for per-site HTML extractors.
3. **Filter.** Items older than 24h are dropped (feeds replay old
   entries; the digest only wants today). `promo.ts` drops sponsored
   inventory; `paywall.ts` flags paywalled domains and subscriber-only
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

`npm run verify -- {day}` (src/digest/verify.ts) is the agent's self-check
before committing: frontmatter shape, links against the day's items,
links against earlier digests (repeat detection), em/en dashes, and the
Threads section. Errors exit non-zero; warnings need judgment.

## The site

`npm run site` (src/site/) renders `digests/` into `site/`: one page
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

One concern per file, one directory per actor:

```
src/day.ts                the one canonical "day": Oslo calendar date
src/log.ts                one-line JSON logs
src/pipeline/             the ingest write path
  sources.ts              config loader + validation
  retry.ts                one-retry policy
  fetch.ts                conditional GET (etag / last-modified / hash)
  promo.ts                sponsored-inventory drop policy
  paywall.ts              paywall flag policy
  day-file.ts             data/items/{day}.json read/write
  state.ts                data/state.json: validators + seen index
  ingest.ts               the pass wiring it all (CLI: npm run ingest)
  cleanup.ts              rolling-month pruning (CLI: npm run cleanup)
  adapters/               registry + rss / arxiv / hn / web (+ extractors)
src/digest/               the digest contract's tooling
  frontmatter.ts          digest file format, shared by verify + site
  verify.ts               digest self-check (CLI: npm run verify -- {day})
src/site/                 the static renderer
  build.ts                digests/ -> site/ (CLI: npm run site)
  page.ts                 html shell, SEO head, design tokens
  markdown.ts             digest markdown -> safe html
  html.ts                 text escaping
  today.ts                today-redirect script for the index
  not-found.ts            the day-aware 404 page
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
- The design tokens in `src/site/page.ts` mirror yasint.dev's
  `tailwind.config.mjs` (the canonical copy) and its `global.css`
  substrate. Retune there first, then sync here and update both tests.
