# gardener journal

Newest first. Entries carry date, what, why (the signal), outcome.
Backlog holds ideas too big for one day; lessons distill Yasin's
merges and closures and never expire.

## Lessons

- (none yet)

## Backlog

- web-dev's feed has been frozen since 2026-06 while the site still
  builds (sitemap lastmod runs current). Recheck around 2026-09-29;
  developer.chrome.com/static/blog/feed.xml is the candidate
  substitute if it stays dead.
- project-zero's feed is 13MB per fetch, twice daily, for a source
  that posts every few months. A cheaper probe strategy is worth a
  look if ingest bandwidth ever matters.
- substack-backed sources (big-technology, normal-technology) send no
  usable validator, so they re-parse every run. Harmless, noted.
- four sources ingest real volume and get cited nothing: console-dev
  (32 items, 0 links in any digest over 32 days), lennys-newsletter
  (24/0), css-tricks (17/0), stackoverflow-blog (16/0). That is ~90
  items a month the digest agent reads past. A prune is a
  config/sources.json one-liner per source, but it is an editorial
  call about breadth, not a health fix, so it wants Yasin's word
  first. Numbers in the 2026-08-31 entry; re-measure before acting,
  a 32-day window is short.

## Entries

### 2026-08-31

Quiet run, no PR, same reason as yesterday: #109 has been open and
unreviewed since 08-29 and the contract allows one open gardener PR at
a time. #109 itself needs nothing — it merges cleanly against today's
main (no commit has touched src/ since it branched), its three Netlify
checks are neutral-not-failing, and the one review on it (Copilot's)
was already answered with a second commit. Improving it further would
be churn, so the run went to signals.

Measured the thing the contract names first and the journal had never
actually counted: which sources carry the digest. For all 32 day files
in data/items (2026-07-31..2026-08-31), items ingested per source
against how many of those item urls appear verbatim in that day's
digest. Two sources do most of the work — techmeme (823 ingested, 372
cited) and hacker-news (915/343) — then the-verge (423/85),
ars-technica (288/77), alphasignal (244/61), arxiv-systems (554/27),
openai (49/15), cloudflare-blog (44/19). The long tail is thin but
mostly cheap: nine enabled sources ingested zero items in the whole
month (karpathy, stripe-blog, slack-engineering, project-zero,
benedict-evans, big-technology, josh-comeau, web-dev, react-blog).

Checked whether those nine are broken or merely quiet, since a feed
that 404s every run leaves no trace in the pipeline — ingest catches
per-source failures into stats.failures and warns, but nothing is
persisted. All nine have healthy data/state.json entries carrying a
feedHash, so each fetched and parsed fine; they are quiet, not broken,
and rare-by-nature sources (project-zero, karpathy) are worth keeping
rare. So no prune here: the honest read is that low volume is not the
problem. The four that ingest steadily and never get cited are, and
they went to the backlog rather than an issue — there are already two
ungreenlit gardener issues open and a third would be accumulation.

Rest of the sweep clean: `npm test` 158/158, `npm run typecheck`
silent, `npm run site` 33 pages at 1.2MB, `npm run verify` ok with
zero warnings on 08-27..08-31 (08-25/08-26 carry the known
HN-permalink and secondary-source "link not found" warnings, not
regressions). goatcounter unreachable from this environment (proxy
403 on CONNECT), so no reader signal this run.

The ingest cron regression from #112 is unchanged and still costing:
no scheduled ingest has fired since 08-30 18:48 UTC, today's 03:15
never ran, and today's morning digest again forced its own
workflow_dispatch at 04:35 before drafting. Eight digest runs in a row
now. Still not mine to fix — both real options edit ../AGENTS.md.

Outcome: no PR by design. #109 pending (3rd day), #110 pending, #112
pending and actively biting.

### 2026-08-30

Health sweep found one real thing. `ingest.yml`'s cron (`15 3` /
`45 15` UTC) stopped landing before the digest windows on 2026-08-27:
scheduled runs went from a steady +13m..+53m across the prior 24 runs
to +3h08..+12h02, and today's 03:15 never fired at all (still absent
at 08:06). Consequence is visible from both sides: seven consecutive
digest runs since 08-27 each forced their own `workflow_dispatch`
ingest minutes before drafting, and the digest commit messages say so
in their own words ("items file was empty (404) at run start, well
past the 03:15 UTC ingest cron"). Today's items file carries
`generatedAt 04:37`, the manual dispatch, not the cron. The morning
margin was only ever ~30 minutes (03:15 cron, 04:34 digest, 36-47m
typical delay), so it was the first to go.

Filed as issue #112 rather than shipped: the two options that
actually cover a cron that never fires both edit ../AGENTS.md, the
digest agent's contract, which is not mine to change. The one option
I could ship alone (move the crons earlier) only widens a window and
would have looked like progress without being any.

Rest of the sweep was clean and stays unfiled: `npm test` 158/158,
typecheck clean, `npm run site` builds 33 pages at 1.2MB, `npm run
verify` returns ok with zero warnings on 08-27..08-30 (the older
warnings are all "link not found in the day's items", the known
HN-permalink and secondary-source pattern, not regressions).

Outcome: no PR by design. #109 pending, #110 pending, #112 filed.

### 2026-08-29

First run. What: swapped the footer disclaimer's text color from
`--faint` to `--muted` (src/site/page.ts, `.foot-note`), matching the
color its own inline link already uses. Why: `npm run site` +
playwright screenshot at 375px showed the note rendering visibly dim;
computed contrast against the pinned palette's own hex values was
~2.7:1 (`--faint` on `--bg`), under WCAG AA's 4.5:1 for normal text.
`--muted` brings it to ~4.1:1, no palette hex touched or added
(test/contract.test.ts unaffected).

Copilot's automatic review on #109 caught a real regression: with the
note and its link both `--muted`, the link (global `a` has
`text-decoration:none`) lost its only non-color signal. Fixed with a
second push: `.foot-note a` gets back a dotted underline, same
pattern `.notify-hint` already uses. Copilot also noted `--muted` is
itself still under AA at 4.1:1; true, but so is every other
`--muted`-tier chrome element sitewide (`.byline`, `.meta`, `.tag`),
so that's a bigger, sitewide repaint call, not this PR's, filed as
issue #110 for Yasin to greenlight. Outcome: pending, PR #109.

Contract written; no run yet. Backlog seeded from the 2026-08-29
refresh audit (source health probe, digest drift review).
