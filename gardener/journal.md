# gardener journal

Newest first. Entries carry date, what, why (the signal), outcome.
Backlog holds ideas too big for one day; lessons distill Yasin's
merges and closures and never expire.

## Lessons

- #109 (2026-08-29, merged 09-01): a one-line token swap with a
  measured before/after (contrast ratio, screenshot) merged clean off
  Copilot's one round-trip, no comment from Yasin needed. Small and
  evidenced is the right size; answer Copilot's findings inline
  (fix what's real, explain what you're not doing and why) rather
  than trying to preempt everything it might flag. Refinement that
  changes which existing token an element uses is gardener work;
  adding or editing a hex is not.
- One-open-PR was a real constraint with a real cost, and the cost is
  what retired it. #109 sat four days, then #116 sat three more while
  two verified fixes queued behind it; on 09-03 Yasin moved the gate
  from his merge to the checks workflow plus revert-fast. The habit
  that survives the change: when a run turns up something shippable it
  cannot ship yet, verify it, revert it, and leave it in the backlog
  marked ready to ship with the recipe — the next slot then spends
  itself in minutes, which is exactly how #116 and the queued
  `color-scheme` fix got written.
- Say the blocked thing out loud, to Yasin, not just to the journal.
  Three consecutive quiet runs read as "nothing to do" from outside;
  what was actually happening was a live security fix waiting on one
  click. The journal is memory, not a channel.

## Backlog

- READY TO SHIP (verified 2026-09-02, blocked only by the open PR
  slot): `color-scheme:dark` on `:root` in src/site/page.ts. The site
  never declares a scheme, so every page renders a white UA scrollbar
  against `#0d0c0b`. One line, no palette hex touched or added, 158/158
  and typecheck silent on the change, all 32 pages plus 404 carry it.
  Recipe for the before/after: build, then playwright at 900x700 with
  `executablePath: "/opt/pw-browsers/chromium"` (the preinstalled 1194
  build; the pinned playwright wants 1228 and will not find it) and
  `ignoreDefaultArgs: ["--hide-scrollbars"]`, which is what makes the
  scrollbar show up in a headless screenshot at all. Right-edge pixels
  at y=350 go `(252,252,252)` to `(44,44,44)`;
  `getComputedStyle(document.documentElement).colorScheme` goes
  `normal` to `dark`.
- web-dev's feed has been frozen since 2026-06 while the site still
  builds (sitemap lastmod runs current). Recheck around 2026-09-29;
  developer.chrome.com/static/blog/feed.xml is the candidate
  substitute if it stays dead.
- project-zero's feed is 13MB per fetch, twice daily, for a source
  that posts every few months. A cheaper probe strategy is worth a
  look if ingest bandwidth ever matters.
- substack-backed sources (big-technology, normal-technology) send no
  usable validator, so they re-parse every run. Harmless, noted.
- SUPERSEDED by issue #120 (2026-09-03): the four uncited sources were
  the small end of a much bigger pattern. Re-measured across all
  sources and the paper feeds are the story — hf-daily-papers,
  arxiv-systems and arxiv-ai are 1,871 of 5,746 ingested items (32.6%)
  and 42 citations (3.9%). Filed for Yasin's editorial call; awaiting
  greenlight.
- RESOLVED 2026-09-03 by Yasin in the contract: the harness appends an
  attribution footer to PR and issue bodies, so strip it right after
  creating (`gh pr edit` / `gh issue edit`); commits carry none
  already. #116's body still has one — it merged before the rule, left
  as-is rather than rewriting a closed record.

## Entries

### 2026-09-03

Quiet run, no PR, third consecutive day blocked on the slot: #116 has
been open and unreviewed since 09-01 and one open gardener PR at a
time is the limit. #116 needs nothing — three Netlify checks
neutral-not-failing, its only comment is netlify's own deploy notice,
no review on it at all, and nothing but data/ has moved on main since
it branched. Left alone. The five undici highs it fixes are still
live on main (`npm audit --omit=dev` confirms all five today), and the
`color-scheme` fix is still queued behind it — re-checked, `:root` in
src/site/page.ts still carries no `color-scheme`, so the backlog
recipe still applies verbatim.

Good news first: **the morning digest is back**. 2026-09-03 landed at
04:46 (#119), and yesterday's miss was recovered later the same day —
digests/ now runs 08-03..09-03 with no gaps. The 09-02 outage was a
single missed window, not the start of a decline, so the escalation
from yesterday can stand down.

Took the blocked run to the signals, and the measurement that came
back reframes a backlog item rather than adding one. The 08-31 pass
counted the top eight sources and the nine that ingest nothing; it
never looked at the middle. Counting all 44 sources that ingest at
all, over 08-03..09-03 (5,746 items, 1,090 cited), the paper feeds are
the story: hf-daily-papers 665/4 (0.6%), arxiv-systems 604/30 (5.0%),
arxiv-ai 602/8 (1.3%). Together 1,871 ingested and 42 cited — **32.6%
of all intake producing 3.9% of citations**. tldr is a fourth of the
same shape (325/4). Next to that, the four sources the backlog had
been holding are 97 items.

Checked it was not a url-matching artifact before filing, since the
digest could plausibly cite a paper by a different url form: rematched
on the bare paper id against the full prose of every digest, any form,
any mention. 38 of 1,200 arxiv ids and 6 of 665 hf-daily ids appear
anywhere. Same answer, so the finding holds.

Filed as issue #120 rather than shipped — it is a prune-or-narrow
decision about breadth, which the contract puts on Yasin's side of the
line. Wrote the caveat into the issue honestly: a low citation rate is
not automatically waste, because these feeds may be earning their
place as background reading the digest agent writes better for without
linking, and that is not something I can measure from here. This makes
a third ungreenlit gardener issue, which 08-31 talked itself out of;
the numbers being 20x bigger is what changed the call, and #120
supersedes the backlog note instead of sitting beside it.

Rest of the sweep clean. `npm test` 158/158, typecheck silent, `npm
run site` 33 pages, `npm run verify` clean on 08-29..09-01. 09-02 and
09-03 each carry one warning, both the known deliberate pattern (a
Chalkbeat primary-source link, then a conscious continuity callback to
it the next day), not regressions. No failed workflow runs in the last
week. goatcounter unreachable for the seventh run (proxy 403 on
CONNECT).

#112's ingest drift is unchanged and still daily: today's 03:15 cron
landed at 07:59 (+4h44), yesterday's 15:45 at 18:57 (+3h12), and this
morning's digest again forced its own workflow_dispatch at 04:37
before drafting. No new comment on #112 — yesterday's already carries
two data points and a third identical day adds nothing.

Outcome: no PR by design. #116 pending (3rd day) and now blocking two
verified fixes. #110 pending, #112 pending, #120 filed.

Later same day, both at once: **#116 merged** (21:02 UTC, 5a33d7a) and
Yasin widened the contract (f4650be, `feat(gardener)!: grant the full
autonomous loop`). main now carries undici 7.29.0, nanoid 3.3.18 and
postcss 8.5.26, so `npm audit` is clean and the five runtime highs are
off the ingest path after 60 hours open. The three-day block is over
and the `color-scheme` fix at the top of the backlog is the next run's
first move.

The contract change is the bigger news and reads as a direct answer to
these three runs: the loop is now the gardener's to finish — file the
issue, build, PR with `Closes #N`, wait out `gh pr checks --watch` as
the review window, self-merge on green, then watch the pages deploy
and revert first if it goes red. A new checks.yml runs test, typecheck
and site build on every PR, which is the gate that replaced Yasin's
merge. Editorial surfaces stay his: Hard limits, config/sources.json,
and both contract files still need a greenlight, so #120 waits exactly
where it is. Also settled the attribution question from the backlog,
in his favour and in writing.

### 2026-09-02

Quiet run, no PR, blocked on the slot again: #116 has been open and
unreviewed since yesterday morning and one open gardener PR at a time
is the limit. #116 needs nothing — it merges clean against today's main
(nothing but data/ has moved since it branched), its three Netlify
checks are neutral-not-failing, no review on it at all. Left alone.

The headline is not mine to fix and needs saying anyway: **there is no
morning digest for 2026-09-02**. digests/ runs 08-02..09-01 with no
gaps, 31 straight days, and today's 04:34 UTC run simply did not
happen — no digest file, no slides, no PR opened today, and none of the
`workflow_dispatch` ingest the digest agent has fired before drafting on
each of the last nine mornings. As of 08:07 UTC that is 3h33 past the
window. First outright miss since the record starts. Data is not the
cause: the 03:15 ingest cron did land today, at 07:52, and
data/items/2026-09-02.json carries 136 items. Pushed to Yasin; the
digest agent's schedule lives outside this repo.

The ingest drift of #112 continues underneath it: 03:15 landed at
07:52 (+4h37), yesterday's 15:45 at 18:51 (+3h06). Commented the two
data points on #112 rather than opening anything new.

Took the blocked run to the craft signal, per the lesson, so the next
free slot spends itself in minutes. Found one: the site never sets
`color-scheme`, so the browser paints its light-mode UA scrollbar —
measured `#fcfcfc`, 15px wide, full height — down the right edge of a
`#0d0c0b` page, on all 32 pages. `color-scheme:dark` on the existing
`:root` block fixes it (scrollbar to `(44,44,44)`, computed scheme
`normal` to `dark`), one line, no hex touched or added, contract test
untouched, 158/158 and typecheck silent. Verified, then reverted; the
tree is clean and it sits at the top of the backlog marked ready to
ship with the screenshot recipe, since headless chromium hides
scrollbars unless you ask it not to and that cost a detour to work out.

Rest of the sweep clean. `npm test` 158/158, typecheck silent, `npm run
site` 32 pages (31 digests + index; 08-01 aged out of the rolling
month, not a regression from yesterday's 33), `npm run verify` ok with
zero warnings on 08-27..09-01. No failed workflow runs in the last
week. `npm audit --omit=dev` still five undici highs on main, which is
exactly what #116 is waiting to fix. goatcounter unreachable from this
environment for the sixth run (proxy 403 on CONNECT).

Outcome: no PR by design. #116 pending (2nd day), #110 pending, #112
pending and now with a missed digest sitting next to it.

### 2026-09-01

Quiet run, no PR, fourth day blocked on the same thing: #109 has been
open and unreviewed since 08-29, and one open gardener PR at a time is
a hard limit. #109 itself still needs nothing — mergeable_state clean
against today's main, three Netlify checks neutral-not-failing, the one
Copilot review already answered by its second commit. Left alone.

This is the first blocked run where the block has a cost worth naming.
The health sweep turned up a real, shippable, one-line-of-intent fix
and it cannot go out: `npm audit --omit=dev` reports five high
advisories against undici 7.28.0 — response desynchronization via the
retry interceptor, two cross-user disclosure paths through
Cache-Control parsing, CRLF injection via blob body `type`, cookie
attribute injection. It is transitive, `cheerio@1.2.0 -> undici@7.28.0`,
and cheerio's fetch is the ingest path's only http client, so this is
runtime surface and not a dev-dep footnote. `npm audit fix
--package-lock-only` resolves all five by moving to 7.29.0: no
package.json change, 10 changed lines in package-lock.json, and on the
bumped tree `npm test` 158/158, typecheck silent, `npm run site` 33
pages. Verified, then reverted — the working tree is clean and the fix
sits in the backlog marked ready to ship. Deliberately not filed as an
issue: it is a day's work, not a big idea, and a third ungreenlit
gardener issue would be accumulation, same call as 08-31.

Rest of the sweep clean. `npm run verify` ok with zero warnings on
08-27..09-01; 08-26 still carries the known "link not found"
warnings (DOJ press release, a TechCrunch piece, an HN permalink), the
familiar primary/secondary-source pattern, not a regression. No failed
workflow runs in the last week. goatcounter still unreachable from this
environment (proxy 403 on CONNECT), so a fifth run with no reader
signal.

#112 unchanged and still compounding: no scheduled ingest has fired
since 08-31 21:06 UTC, today's 03:15 never ran, and this morning's
digest again forced its own workflow_dispatch at 04:36 before drafting.
That is nine consecutive digest runs self-rescuing. Scheduled runs that
do land are now +3h to +6h behind their cron, never inside the window
they were written for. Still not mine to fix — both real options edit
../AGENTS.md.

Then Yasin merged #109 mid-run — Copilot's link-underline finding was
the only round-trip, no comment from him needed, the first closed loop
for this contract and the direction confirmed. That freed the slot, so
the day did ship after all. Took the backlog item first as it said to.
Narrowed it on the way: `npm audit fix` also drags nanoid and postcss
along, so I tried `npm update undici` alone (3 lines) before deciding
the wider fix was the better one — nanoid <=3.3.17 and postcss <=8.5.22
carry two highs each of their own (degenerate-size loops,
sourceMappingURL path traversal), dev-only under vitest with no real
exposure here, but leaving them means every future sweep rediscovers
known noise instead of a real signal. Shipped all three as #116:
lockfile only, 10 lines, package.json untouched, `npm audit` from 2 high
to zero, and the tree green (158/158, typecheck silent, 33 pages, verify
clean on 09-01). Offered in the PR body to trim it back to undici alone
if he would rather keep dev-tool churn out of the lockfile.

Outcome: #109 merged (lessons updated), #116 open. #110 pending, #112
pending and biting daily.

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
