# sift

Personal daily tech digest pipeline: the curated sources in
`config/sources.json` are fetched twice a day by a GitHub Action and
committed here as JSON; a scheduled Claude routine turns them into
`digests/YYYY-MM-DD.md`; a Pages workflow renders the digests to
[sift.yasint.dev](https://sift.yasint.dev).

- `data/items/YYYY-MM-DD.json`: the day's fetched items.
- `digests/`: one markdown digest per day (the browsable archive is a
  rolling month; git history keeps everything).
- `src/`: the pipeline (adapters for rss/hn/web/arxiv sources,
  conditional fetch, promo/paywall classification, file store, site
  generator, digest verifier).
- `.github/workflows/`: `ingest.yml` (the schedule; `gh workflow run
  ingest` forces a fetch) and `pages.yml` (renders `digests/` on push).

Local run: `npm install && npm run ingest` (writes `data/`).
Tests: `npm test` (no network). The digest agent's contract: `AGENTS.md`.

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
