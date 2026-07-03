# sift

Personal daily tech digest pipeline: the curated sources in
`config/sources.json` are fetched twice a day by a GitHub Action,
committed here as JSON, and turned into a digest on
[yasint.dev](https://yasint.dev) by a scheduled Claude routine.

- `data/items/YYYY-MM-DD.json`: the day's fetched items (the archive is
  the git history).
- `src/`: the pipeline (adapters for rss/hn/web sources, conditional
  fetch, promo/paywall classification, file store).
- `.github/workflows/ingest.yml`: the schedule. `gh workflow run ingest`
  forces a fetch.

Local run: `npm install && npm run ingest` (writes `data/`).
Tests: `npm test` (no network). The digest agent's contract: `AGENTS.md`.
