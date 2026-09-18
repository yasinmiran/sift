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
- A backlog recipe is a hypothesis with a shelf life, not a fact banked
  for later. 09-02 and 09-04 both banked "ready to ship" items; the
  `color-scheme` one held verbatim, the checks.yml one was wrong on
  every claim it made and would have shipped a no-op. Re-derive the
  premise from primary evidence before spending the slot — read the
  actual job log, not the note about the job log — and treat a recipe
  written by a past run with the same scepticism as a claim from
  anywhere else. Retiring a backlog item on evidence is a real day's
  work; it is cheaper than the PR that would otherwise have shipped.
- A label the journal inherits is not evidence either. Five entries running
  called the verifier's recurring warnings "the known deliberate pattern
  (primary-source links, HN permalinks)"; on 09-06 the data said half of that
  was a blind spot in the verifier, 52 false positives across 23 days. The
  phrase had been copied forward, never re-derived. When a signal recurs and
  the run reaches for last run's words to dismiss it, that is the moment to
  go back to primary data — the cheapness of the explanation is what hides
  the bug.
- Elapsed time is read from `date`, never inferred. On 09-04 a
  backgrounded `sleep` does not block the run that starts it, so a
  string of "waits" that each returned instantly made a healthy
  110-second `npm ci` look like a 40-minute stall, and a green run got
  cancelled for nothing. Cost: one wasted CI cycle. Wait by blocking on
  the thing itself (`until <state> = completed; do sleep 15; done`
  against the api) and sanity-check the clock before concluding
  anything is stuck.

## Backlog

- A title is the one ingested field with no whitespace normalization. Author got
  it on 09-15 (`authorName` collapses and trims), content has always had it
  (`htmlToText` ends in `.replace(/\s+/g, " ").trim()`), and the rss adapter
  hands `stripInvisibles(decodeNumericRefs(e.title))` through untouched; hn and
  arxiv pass theirs through raw, the three web extractors normalize their own.
  21 of the 6,122 archived titles change under collapse+trim, every one of them
  trailing-only, 7 ending in a nbsp: eff-deeplinks 6, crunchbase-news 4,
  newcomer 4, lennys-newsletter 2, the-verge 2, one each from nvidia-blog,
  stackoverflow-blog and huggingface-blog. No downstream consequence found —
  the dedup key never reads the title and no title reaches the site — so it is
  banked, not shipped: fold it into the next PR that touches `rss.ts` for a real
  reason rather than spending a slot on 21 trailing spaces.
- Two content-shape findings that need the raw feed to diagnose, and the raw
  feed is exactly what this environment cannot fetch (403 at CONNECT on every
  host, curl and WebFetch alike). Recorded so a run with egress can pick them
  up, and NOT as recipes — neither cause is established.
  the-verge: 118 of 470 archived summaries (25.1%) open with a photo caption
  and credit before the story ("Mark Zuckerberg. | Image: Cath Virginia / The
  Verge; Getty Images Meta CEO Mark Zuckerberg now owns…"). Reads like a
  `<figcaption>` flattened into the text, but whether the credit sits in one is
  a guess until someone reads `content:encoded`.
  vercel-blog: 26 of 77 summaries begin mid-sentence (", the flagship of
  OpenAI's GPT-5.6 series, is 50% off…") with the missing subject turning up
  later in the same text ("…(not BYOK).GPT-5.6 Sol"), and 58 carry a sentence
  glued to a following fragment. Something in that feed's markup is read out of
  document order; cheerio's `.text()` is document order, so the interesting
  question is what shape the feed sends, and that needs the feed.
- SHIPPED 2026-09-16 as #167 / PR #168: an hn self-post stores its permalink.
  The 09-15 recipe held — same 21 items, still 21 against a grown archive
  (5,835 items, 992 of them hn) — and both questions it left open answered
  from data/ before any code: five of the 21 were cited, three linked only
  because the digest agent hand-built the permalink and one mentioned with no
  link at all, so a pipeline gap, not an editorial call. Third backlog recipe
  to survive re-derivation intact.
- SHIPPED 2026-09-14 as #159 / PR #160: rss titles decode numeric refs. The
  09-13 rewrite held verbatim against a fresh scan — 49 titles, 66
  occurrences, all the-verge — which is the second backlog recipe to survive
  re-derivation intact. The `htmlToText` trap it recorded is now a test.
- RESOLVED 2026-09-14 in PR #160, and the note itself was half wrong. The
  first half held: rss-parser 3.13.0 resolves the common html entities
  natively — probed again, every one of the thirteen in `HTML_ENTITIES` plus
  `&eacute;`, `&pound;`, `&hearts;` and more — so rss.ts's tldrsec `&nbsp;`
  comment no longer reproduced and is corrected. The second half does not:
  this note claimed the map still earns its place because a title skips
  cheerio, and the probe that settled it says otherwise — a raw parser, no
  sanitizer, reads `a&nbsp;b` in a *title* as `a b`. So the map is belt and
  braces against a future parser, nothing more; what is load-bearing is the
  fallback that neutralizes a name the parser does not know. Written that way
  in the comment now. Lesson in miniature: the correction I banked was itself
  a claim I had not probed.
- A *named* entity in a title would still store literally — the new decode is
  numeric-only, deliberately, since a named pass needs a table and zero of
  the 5,637 archived titles carry one. Same call site if one ever shows up;
  not worth pre-building.
- Left deliberately out of #153, recorded so a later run does not re-file it
  as an oversight: `ref` (38, all `console.dev`) and `source` (2, medium's rss
  token) are tracking here but are functional param names elsewhere
  (`?ref=main` on a github file url), and 40 occurrences in 5,765 do not earn
  that false positive. Revisit only if a `ref=` ever reaches a digest link.
- RETIRED 2026-09-05, the diagnosis was wrong on both counts and the fix
  would have been a no-op. checks.yml does not have an install cliff.
  #124's 7m02s `npm ci` was a cache **hit** on key `a401ab82…`, the same
  key and the same "added 84 packages" as 09-05's run, which took **3s**.
  Not a lockfile-change cache miss. Nor is it playwright: `playwright`
  ships no install or postinstall script (verified on 1.61.1 — the only
  install hook in the whole tree is esbuild's), so `npm ci` never
  downloads browsers here; they arrive solely from the explicit
  `npx playwright install` in pages.yml. `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD`
  on the checks job would change nothing. The 7 minutes was a single
  silent stall inside one npm ci, and that run alone printed no "audited
  85 packages / found 0 vulnerabilities" lines that both the 09-05 CI run
  and a local `npm ci` print — consistent with npm's registry audit call
  hanging and eventually being abandoned. Transient infrastructure, not a
  repo defect. Do not re-file without a second occurrence.
- SHIPPED 2026-09-07 as #132 / PR #133: the per-occurrence "link not found"
  warning is deduped. The premise re-derived clean from primary data before
  the slot was spent, which is the first backlog recipe to survive that test
  intact.
- Merged gardener branches cannot be deleted from this environment:
  `git push origin --delete` dies on a sideband disconnect through the
  proxy and the api token gets 403 on `DELETE /git/refs/heads/...`.
  gardener/2026-09-04-color-scheme-dark,
  gardener/2026-09-06-verify-hn-permalinks,
  gardener/2026-09-07-verify-dedupe-link-warnings and
  gardener/2026-09-08-fonts-non-blocking,
  gardener/2026-09-09-drop-times-dst,
  gardener/2026-09-10-actions-node24,
  gardener/2026-09-11-sw-notification-click,
  gardener/2026-09-12-strip-tracking-params,
  gardener/2026-09-13-cdata-entities,
  gardener/2026-09-14-title-numeric-entities,
  gardener/2026-09-15-author-name,
  gardener/2026-09-16-hn-self-post-url and
  gardener/2026-09-17-htmltotext-drop-style and
  gardener/2026-09-18-structured-data-drop-times are all merged and all
  still on the remote. Either Yasin prunes them, or the repo turns on
  auto-delete-on-merge in its settings, which would close this for good.
  Fourteen now; it grows by one every shipping run.
- Seven enabled sources produced **zero items in the whole 32-day archive**:
  karpathy, stripe-blog, slack-engineering, big-technology, josh-comeau,
  web-dev, normal-technology. Not failures — today's ingest logged
  `failures: []`, and the four that were fetched this run all parsed fine and
  simply had nothing inside the 48h window (`kept: 0` against `dropped` of
  20/88/20/10). So this is either genuinely low-frequency blogs or dead feeds,
  and telling those apart per source is the work. Registry consequences are
  editorial, so this ends as an issue, not a PR — but #120 is already waiting
  on the same kind of call and a second unanswered editorial issue helps
  nobody. Re-measure when #120 moves; fold the web-dev recheck (below) into it.
- Noticed while fixing #148, too small to spend a slot on. The `push` handler
  does `event.data.json()` unguarded, so a payload that is not json throws and,
  on a `userVisibleOnly` subscription, the browser substitutes its own generic
  "this site has been updated in the background" notification. Only push/ sends
  to these subscribers and it always sends json, so this is theoretical today —
  but push/ is a deployed sidecar I cannot see or test. If a run ever touches
  sw.ts again, wrap it in a try and fall through to the existing defaults.
- `state.sources` in data/state.json is never pruned, unlike `seen`.
  shopify-engineering, tbpn and boris-cherny are gone from config/sources.json
  and their conditional-GET validators are still in the file. Harmless today
  (a resurrected slug would just get a 200 on a stale etag) and roughly 200
  bytes of cruft, so not worth a slot on its own; if a run ever touches
  state.ts for a real reason, add the prune in the same PR.
- Walked clean on 2026-09-10, recorded so a future run does not re-walk them.
  Tap targets: every interactive element on the index and a day page measured
  at 375px and 1280px. The 31 `.days` anchors are 20px tall, under WCAG 2.5.8's
  24px, but the gaps between them are 111-180px, so the spacing exception
  applies with enormous margin; prose links are covered by the inline
  exception, and the footer's `yasin`/`rss` pair sits ~42px centre-to-centre
  against a 24px requirement. No violation. The maskable icon: icon-512.png
  and icon-512-maskable.png are byte-identical (sha256 `5e1fcdfb…`), which
  looks like a mistake and is not one — the mark is a centred dot about 60% of
  the frame, comfortably inside the 80% safe-zone circle, and a maskable icon
  is supposed to bleed its background to the edge. The `.foot-note` measure:
  `max-width:60%` gives ~50 characters a line on desktop and ~33 on a phone,
  which is a percentage doing opposite things at the two ends, but the note is
  two lines of 11px chrome and changing it would have been fashion, not a fix.
- Walked clean on 2026-09-08, recorded so a future run does not re-walk them:
  the slide cards (520 rendered across 32 days, no card clips — every card's
  lowest element bottom lands exactly on the 1262px padding edge, never past
  it) and horizontal overflow on the built site (34 pages at 375px and
  1280px, zero pages scroll sideways, zero elements escape the viewport).
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

### 2026-09-18

Shipped. What: a day page carries the drop it belongs to (#174, PR #175, merged
4cf423d). Why: one build pass said two different things about when a page went
up. `feed.xml` carried the morning drop as an instant, `Fri, 18 Sep 2026
04:34:00 GMT`, while the json-ld and og tag written in the same pass carried a
bare `2026-09-18` — midnight in whatever zone the reader assumes. `feedDate()`
already knew the schedule; the other two were handed `d.day`.

`dateModified` was the part that was not merely imprecise. It equalled
`datePublished` on all 32 rendered pages while 31 of the 32 days in data/slides/
carry a pm carousel post, which is what the evening rewrite leaves behind. Every
page claimed it had not changed since publication and 31 of them had, twelve
hours later.

Copilot earned its keep this run, and the finding was real: a pm-only carousel
is not an evening rewrite. AGENTS.md says so in as many words — "a day whose
morning run was skipped gets its single post as `pm`, covering the full day; a
day never gets an `am` retroactively" — and 2026-09-14 is exactly that day, the
morning the digest run did not fire at all (the same failure #112 tracks). The
first pass got **both** halves of that day wrong, not just the one the review
named: published 04:34 as well as modified 16:34, when it went up once at 16:34
and was never rewritten.

The fix is not the one the review proposed (require both slots). The slots
present *are* the drops that produced the page, so the first is the publication
and the last the modification: am+pm 04:34 → 16:34, am-only 04:34 → 04:34,
pm-only 16:34 → 16:34, no carousel or an unreadable one 04:34 → 04:34. All three
live shapes come out right against the archive. Reading the carousel from the
site build is new coupling and the PR says so; it is read defensively, because a
malformed one is verify.ts's error to report and never a reason the site fails to
build.

Lesson in miniature, and the second time this month a review beat me to a case in
my own data: I had counted the pm posts (31 of 32) and never asked what the
thirty-second and the *shape* of the other outlier meant. 09-14 was in front of
me twice — the smallest slides file in the directory, and a day #112's own
comment records as having no morning run — and I read the count without reading
the exception.

Evidence discipline held otherwise. Diffed both built trees: the whole change is
two head lines per day page, and index.html, feed.xml, sitemap.xml, 404.html and
sw.js come out byte-identical, which is why there are no screenshots. Every new
or re-pinned assertion was run against the build it was written for and fails
there, the pm-only one included. 190 tests from 186, typecheck silent, 33 pages,
verify clean on 09-18.

The sweep also confirmed two earlier fixes from data rather than from memory,
which is the 09-06 lesson applied on purpose. 09-12's `stripTracking`: 267 stored
urls carried a `utm_*` or `smid` tag across 08-18..09-11, on all 19 of those days
that ingested any, thirteen to fifteen a day and every one of them tldr; from
09-12 the count is zero on every day. 09-13's CDATA fix: 43 items stored a live
named entity in their content (`&eacute;`, `&pound;`, `&euro;`, techmeme 30 and
the-verge 13) across 18 days ending 09-12, and zero since. That second one is a fix nobody claimed — the 09-13 PR was about
titles, and content was collateral it never measured.

Two findings the sweep turned up and did not spend the slot on. Cross-source
duplicate urls inside a day file: 47 of 6,290 items (0.75%), 15 days, the pairs
led by hacker-news+tldr and ars-technica+tldr. Left alone deliberately — the same
story reaching two feeds is arguably signal for the digest agent, and deduping it
is an editorial call, not a health fix. And 22 of the 32 day pages carry a meta
description over 200 characters, up to 310; search snippets truncate around 160.
Not filed as a defect: google takes the full description and truncates for
display, so trimming it would be fashion, and the description is the digest
agent's editorial surface anyway.

Rest of the sweep clean. `npm run verify` across 09-12..09-18 is `ok: true` on
all seven; warnings are the familiar editorial ones (techmeme primary-source
pairs that are also `already digested`, one x.com link thrice, and 09-17's "62
links" from its full-day rewrite), with 09-14, 09-15 and 09-18 silent. No failed
workflow run in the last 20 listed. The built pages walked clean on a scripted
audit of all 33 — no duplicate ids, no empty links, no heading-level skips, one
main and one h1 each, every title inside 65 characters — recorded so a future run
does not re-walk it.

Also walked and cleared, so it is not re-filed as a bug: 15 items store angle
brackets in their content (`<issuerId>`, `Vec<T>`, `#include <errno.h>`), and all
fifteen are prose about code that the feed escaped and cheerio correctly decoded.
Not leaked markup.

#112, unchanged for the nineteenth day. Today's `15 3` had still not fired at
08:06, **+4h51**; the last scheduled run of any kind is 09-17 19:18 (`45 15`,
+3h33). The morning digest forced its own `workflow_dispatch` ingest at 04:36 and
pages went green at 04:47, the fourth morning running the workaround has held. No
new comment — 09-14's already describes this state.

goatcounter and sift.yasint.dev both 403 at CONNECT again, probed rather than
assumed: twenty-second run with no reader signal and no post-deploy look at the
live site, pages run 252's own green (122s) standing in. Branch deletion failed
the same sideband way as every shipping run; fourteen merged gardener branches on
the remote now.

Attribution: PR body footer stripped, and the footer on my reply to Copilot too —
first run a comment needed it, since the harness appends one there as well. Issue
body had none. Commit trailers and this journal's trailer kept. Thirteenth run of
that convention.

A process note worth keeping: three "waits" for the review window returned
instantly because a backgrounded `sleep` does not block the run that starts it.
That is 09-04's lesson exactly, and I walked into it anyway — six minutes of
apparent elapsed time were fifty seconds of real time, caught only by reading
`date`. It cost nothing this run because the check was a clock and not a merge
decision, but the habit that prevents it is the one already written down: read
elapsed time from `date`, and block on the thing itself.

Outcome: #174 filed and closed by #175, merged and deployed. #110, #112 and #120
all still pending — #120 since 09-03, fifteen days.

### 2026-09-17

Shipped. What: a feed's own stylesheet stops reaching the summary (#171, PR
#172, merged 9283a3b). Why: every one of tl;dr sec's four issues in the 32-day
archive stores the same 460 characters of beehiiv's table stylesheet ahead of
the newsletter's first word — `.bh__table, .bh__table_header, .bh__table_cell
{ border: 1px solid #C0C0C0; } …` on 08-20, 08-27, 09-08 and 09-10, byte for
byte. `htmlToText` loads the body with cheerio and returns `$.root().text()`,
which reads a `<style>` or `<script>` element's text like any other, so the
chrome went in with the prose.

The honest gap, written into the issue and the PR rather than smoothed over:
rss.beehiiv.com is 403 at CONNECT like every other host here, so the raw feed
could not be read this run and the `<style>` diagnosis is inference. What
carries it without the feed is the stored text itself. Had the css arrived
escaped, `.text()` would have decoded it and the content would carry a literal
`<style>`; none of the 6,122 items does. And css only reaches `.text()` from
inside a script or style element, which leaves one other reading — that tl;dr
sec types a stylesheet at the top of every issue — and that is not a reading.
Confirmable for free next week: the next tl;dr sec issue lands with a clean
summary or it does not.

Script went along with style on argument, not evidence, and the PR says so: no
stored content anywhere in the archive carries json-ld, gtag or any other
script text. It is the same hole, one selector wide, and waiting for a feed to
prove it would be waiting for a bug.

What the fix is not: a whitespace pass. `htmlToText` already collapsed and
trimmed, and the two new tests pin the shape both ways — the beehiiv body comes
back as its prose, and prose that merely talks about a selector
(`Write .a{color:red} and see`) is untouched. Both fail against the unfixed
cleaner, checked before pushing. 186 tests from 184, typecheck silent, 33
pages, verify clean on 09-17. No screenshots: this changes what the digest
agent reads, not what the site renders.

Copilot posted at 1m46s: 🟢 approval recommended, zero comments, "review effort
level: Lite" — third run in a row. checks green in 18s, merged rebase, pages
run 249 green in 94s.

Two findings the sweep turned up and did not spend the slot on, both in the
backlog above: titles are the one field with no whitespace normalization (21 of
6,122, all trailing, no downstream consequence found), and two content shapes
in the-verge and vercel-blog that cannot be diagnosed without the raw feeds.
Banking the second pair as observations rather than recipes is deliberate —
09-04's lesson is that a recipe written without the primary source is a
hypothesis wearing a fact's clothes.

09-14's numeric-ref fix looks healthy but the archive cannot prove it alone:
the-verge's last entity-spelled title is 09-11, and 09-14 through 09-17 carry 28
decoded apostrophes and zero entity spellings. The drought starts two days
before the fix landed, so the feed may simply have stopped sending that
spelling. Watch, do not claim.

Rest of the sweep clean. `npm run verify` across 09-11..09-17 is `ok: true` on
all seven, warnings all the familiar editorial ones (two techmeme
primary-source pairs that are also `already digested`, one x.com link thrice);
09-14, 09-15 and 09-17 silent. No failed workflow run in the last 20 listed.

#112, unchanged for the eighteenth day. The morning digest forced its own
`workflow_dispatch` ingest at 04:36 and pages went green at 04:48, the third
morning running that the workaround has held. The cron has not: today's `15 3`
had still not fired at 08:17, **+5h02**, and the last scheduled run of any kind
is 09-16 19:06 (`45 15`, +3h21). No new comment — the 09-14 comment already
describes this state.

goatcounter and sift.yasint.dev both 403 at CONNECT again, probed rather than
assumed: twenty-first run with no reader signal and no post-deploy look at the
live site, the pages run's own green standing in. Branch deletion failed the
same sideband way as every shipping run; thirteen merged gardener branches on
the remote now.

Attribution: PR body footer stripped (the harness appended one), issue body had
none, commit trailers and this journal's trailer kept. Twelfth run of that
convention.

Outcome: #171 filed and closed by #172, merged and deployed. #110, #112 and
#120 all still pending — #120 since 09-03, fourteen days.

### 2026-09-16

Shipped. What: an hn self-post stores the permalink it always had (#167, PR
#168, merged 98b29ec). Why: 21 of the 992 hacker-news items in the 32-day
archive (2.1%) store `url: null`, every one a self-post — `Ask HN:`, `Tell
HN:`, `Launch HN:`, plus a handful of bodied text posts — and all 21 carry
`story_text`, so the body is the post and Algolia sends no url for it.
`mapHit` mapped that nothing straight through.

The backlog note from 09-15 held on re-derivation: still exactly 21, now
against 5,835 items rather than 5,576, and the same source and shape. Third
recipe to survive that test intact, against two that did not.

Both questions it left open answered from data/ before anything was written,
and they answered each other. Five of the 21 reached a digest. Three are
linked — 49322107 twice on 08-17, 49331033, 49657850 on 09-11 — every one
because the digest agent built `item?id=` by hand, which its contract tells it
to do for a heavily discussed story. One is not: 08-27 reads "reports that
both Xcancel and Nitter have been taken down" with no link, in a sentence
where tailcat, the arxiv linker and Mechanical Turk each carry one. The story
the pipeline handed over without a url is the story that went out unlinked, so
this is a pipeline gap and not an editorial call — the pipeline has a link for
every hn item and was dropping it for the 2% with nowhere else to point.

What made it cheap was that the blast radius is checkable rather than
arguable, and all of it came back clean: the dedup key is
`sourceSlug:externalId` and never read the url, so the seen index is
untouched; all 21 permalinks replayed through the real `safeHttpUrl` +
`stripTracking` come back byte-identical (it drops `utm_*` and `smid` only, so
`?id=` survives — worth checking, since a url whose whole meaning is one query
param would be a silly thing to strip); none of the 21 reads as promotional or
paywalled; and no stored hn url is an empty string, so `||` cannot overwrite a
story that has an article. That last one is now an assertion in the existing
front-page test rather than a claim in a commit message. The new test fails
against the unfixed adapter, checked before pushing. 184 tests from 183,
typecheck silent, 33 pages. No screenshots: nothing under src/site or
src/slides reads data/items, so there is no visual surface to photograph.

The verifier's HN-permalink allowance stays as it is. It is not made redundant
by this — it still covers the common case, a story whose article url is stored
and whose discussion the digest links instead.

Copilot posted in under two minutes again: 🟢 approval recommended, zero
comments, "review effort level: Lite". checks green in 19s, merged rebase,
pages run 246 green in 116s.

Rest of the sweep clean. `npm run verify` across 09-10..09-16 is `ok: true` on
all seven, warnings all the familiar editorial ones (two techmeme
primary-source pairs that are also `already digested`, one x.com link thrice,
one 63-link day); 09-14 and 09-15 silent. No failed workflow run anywhere in
the last 30 listed, back to 09-13.

#112, unchanged in substance and still unanswered. The morning digest ran: it
forced its own `workflow_dispatch` ingest at 04:36, drafted, and pages went
green at 04:48, so the workaround held for the second day running. The cron
itself has not: today's `15 3` had still not fired at 08:14, **+4h59**, and the
last scheduled run of any kind is 09-15 19:14 (`45 15`, +3h29). No new comment
— the 09-14 comment describes this state already, and repeating it daily is
noise.

goatcounter and sift.yasint.dev both still 403 at CONNECT through the proxy,
probed again rather than assumed: twentieth run with no reader signal and no
post-deploy look at the live site, the pages run's own green standing in.
Branch deletion failed the same sideband way as every shipping run; twelve
merged gardener branches on the remote now.

Attribution: PR body footer stripped (the harness appended one), issue body had
none, commit trailers and this journal's trailer kept. Eleventh run of that
convention.

Outcome: #167 filed and closed by #168, merged and deployed. #110, #112 and
#120 all still pending — #120 since 09-03, thirteen days.

### 2026-09-15

Shipped. What: a feed author stores a name, not the parser's node (#163, PR
#164, merged 3be1f79). Why: of the 5,576 authors in the 32-day archive, 292
(5.2%) hold something that is not a name. 17 hold the xml parser's node for a
whole `<author>` element — `{"$":{"xmlns:author":"…/Atom"},"name":["Eileen
Mannion"],"title":["VP, Marketing UKI and EMEA Devices and Services"],…}` —
against a field declared `string | undefined` in RawItem and `string | null` in
the day file. 275 hold a padded string, ars-technica's `dc:creator` spanning
lines, 268 of them.

The object half is not an edge case, which is what made it worth a slot: 11 of
google-ai-blog's 12 authored items and 6 of nextjs-blog's 6 — every single one,
latest 09-14. The blob also carries a *job* title one field from the item's own.

The diagnosis the probe overturned is the part worth keeping. Both shapes read
as an atom problem: structured `<author><name>` is atom's idiom, and the stored
blob even carries the atom namespace as an attribute. Through the real adapter,
atom comes back clean — rss-parser resolves `<author><name>` itself, which is
why simonwillison and github-blog are strings — and the blob reproduces
byte-identically only on the **rss 2.0** path. Both sources are rss
(`blog.google/…/rss/`, `nextjs.org/feed.xml`). Had I trusted the namespace
attribute in the data I would have written the fix against the wrong branch and
had a passing test to go with it, which is the 09-13 trap in a new costume: the
thing that looks like the diagnosis is a feed's own spelling, not the code path.

Why it survived a year of typechecks: rss-parser's `Item` declares no `author`,
so `e.author` resolves through the output's index signature as `any` and the
declared string was never checked. `FeedItem` now spells it `unknown` so the
next reader sees what actually arrives. Author was also the one field no cleaner
touched — title goes through decodeNumericRefs + stripInvisibles, content
through htmlToText, url through stripTracking + safeHttpUrl.

Evidence was the archive, not a spot check: all 5,576 stored authors replayed
through `authorName`, 296 change (the four extra over the scan's 292 are
meta-engineering's empty strings, now absent rather than blank) and 5,280 come
back byte-identical. Both adapter-level tests fail against the unfixed call
sites, checked before pushing. The arxiv fixture now carries the padding the
archive's arxiv creators really have, so the assertion already sitting in that
test covers the fix rather than a new test restating it. 183 tests from 179,
typecheck silent, 33 pages, verify clean.

Copilot posted inside two minutes this time — 🟢 approval recommended, zero
comments, "review effort level: Lite" — after saying nothing at all on 09-14.
So it is neither stuck nor gone. checks green in 20s, merged rebase, pages run
243 green in 91s.

Rest of the sweep clean. `npm run verify` across 09-09..09-15 is `ok: true` on
all seven, warnings all the familiar editorial ones (primary-source links, two
`already digested`, one 63-link day); 09-14 and 09-15 are silent. No failed
workflow run anywhere in the listed week.

#112, both halves, one better and one not. The morning digest **is** back: it
ran at 04:34, forced its own `workflow_dispatch` ingest at 04:36 as the twelve
mornings before 09-14 did, and pages went green at 04:45. So yesterday's second
missed digest did not become a third. The ingest cron is unchanged: today's
`15 3` had still not fired at 08:23, **+5h08**, matching yesterday's widest,
and the last scheduled run of any kind is 09-14 19:56 (`45 15`, +4h11). No new
comment on #112 — the 09-14 comment already describes exactly this state minus
the missed digest, and a daily repetition of an unanswered issue is noise, not
signal. Recorded here instead.

An honest miss to record: I went looking for a missing `sitemap.xml` after a
truncated `ls` showed robots.txt advertising one. It is generated (build.ts:154)
and was in the directory all along, eight entries past where the output stopped.
Cost: two minutes. A truncated listing is not evidence of absence, which is the
same shape of error as trusting a backlog note.

goatcounter and sift.yasint.dev both still 403 at CONNECT through the proxy —
nineteenth run with no reader signal and no post-deploy look at the live site;
the pages run's own green stands in. Branch deletion failed the same sideband
way as every shipping run; eleven merged gardener branches on the remote now.

Attribution: PR body footer stripped (the harness appended one and my own draft
carried one, both gone), issue body had none, commit trailers and this journal's
trailer kept. Tenth run of that convention.

Outcome: #163 filed and closed by #164, merged and deployed. #110, #112 and
#120 all still pending — #120 since 09-03, twelve days.

### 2026-09-14

Shipped. What: rss titles decode numeric character references (#159, PR #160,
merged 960f2d1). Why: 49 of the 5,637 titles in the 32-day archive store one as
text — `&#8217;` 53 occurrences, `&#8216;` 11, `&#038;` 2, all the-verge.
`It looks like Apple&#8217;s iPhone 18`, `This is Instagram&#8217;s new logo`.
Titles only; content, author and url clean; nothing published carries it.

Walked the backlog item the 09-13 run rewrote, and this time the recipe held
verbatim — same 49 titles, same three spellings, same source, re-scanned from
data/items rather than read off the note. Second recipe to survive
re-derivation intact, against two that did not. What re-deriving is for is not
catching a lie every time; it is that the two kinds of note are
indistinguishable until you check.

Content is spared because it goes through cheerio on the way to text; a title
never does. Probed through the real adapter again: a CDATA-wrapped `&#8217;`
and a double-encoded plain `&amp;#8217;` both reproduce the stored string
exactly, and since the fix is identical for both, which one the-verge sends
never had to be settled — the question the last two runs kept reaching for was
not on the path.

Decode before strip, so a watermark arriving as `&#8203;` is zero-width by the
time the stripper looks. One pass, so a decoded `&` cannot make the text after
it into another reference. A reference no character answers to — lone
surrogate, past the last code point — is left standing rather than turned into
a replacement character. Targeted rather than `htmlToText`, which the 09-13
note had measured and which is now a test: cheerio eats arxiv-ai's
`<<History>>` and css-tricks's `<geolocation>,`.

Evidence was the archive, not a spot check: all 5,637 stored titles replayed
through the decoder, 49 change, each one checked segment by segment (literal
text between the references identical, each reference exactly one code point),
and 5,588 byte-identical. Both new adapter tests fail against the unfixed
adapter — the 09-13 lesson about a test that passes against the code it is
meant to catch, applied before pushing rather than after. 179 tests from 174,
typecheck silent, 33 pages.

Rode along: the comment above `HTML_ENTITIES`, which the backlog had been
holding for the next run to touch rss.ts. Probing it turned the note against
itself — it said the map earns its place because a title skips cheerio, and a
raw parser with no sanitizer reads `a&nbsp;b` in a title as `a b`. The map is
belt and braces; the fallback for an unknown name is what actually saves the
feed. A correction banked by a past run is still an unprobed claim.

Copilot never posted. Its run went in_progress at 08:12:24 and was still
in_progress, `updated_at` frozen at 08:12:30, eleven minutes later; checks went
green in 25s, which is the gate the contract names, so the merge went on the
checks. First run since the bot arrived where it said nothing at all — worth
watching whether it is stuck or gone, not worth acting on yet.

Rest of the sweep clean. 100 workflow runs listed back to 09-06, every one
`success`, so no failures anywhere in the last week. `npm run verify` across
09-07..09-13 is `ok: true` on all seven, warnings all the familiar editorial
ones (primary-source links, two `already digested`, one 63-link day).

Two health notes, both worse than yesterday. **No morning digest today**: no
`digests/2026-09-14.md`, no am slides, no items file, and no forced
`workflow_dispatch` ingest before it — the 04:34 window simply passed. That is
the second occurrence, after 09-02, and the first one that is not a one-off.
And today's `15 3` ingest cron had still not fired at 08:24 UTC, **+5h09** and
counting, the widest yet (09-13 +5h00, 09-12 +4h37). Both commented onto #112
rather than a new issue, since #112 already holds exactly this pair.

goatcounter and sift.yasint.dev still 403 at CONNECT through the proxy, so no
reader signal for the eighteenth run and no post-deploy look at the live site;
the pages run's own green stands in. Branch deletion failed the same sideband
way as every shipping run — ten merged gardener branches on the remote now.

Attribution: PR body footer stripped, issue body had none to strip, commit
trailers and this journal's commit trailer kept. Ninth run of that convention.

Outcome: #159 filed and closed by #160, merged and deployed. #110, #112 and
#120 all still pending — #120 since 09-03, eleven days.

### 2026-09-13

Shipped. What: the entity sanitizer stops reaching inside CDATA (#156, PR #157,
merged acdb1b7 and 1b2719b). Why: 43 of the 5,601 items in the 32-day archive
store a literal html entity where a character belongs — 68 occurrences, content
only, techmeme 43 and the-verge 25. `a &pound;545M cash takeover`, `Brussels
fined Google &euro;890 million`, `a record &yen;1 trillion bond`, `Niclas
Negl&eacute;n`, `Michael Nu&ntilde;ez`, `jalape&ntilde;os`, `Pok&eacute;mon`.

Ours, not the feeds'. `sanitizeEntities` rewrites every non-xml named entity to
`&amp;NAME;` so one sloppy `&nbsp;` cannot kill a parse; inside CDATA an `&` is
already literal, so the rewrite only adds an `&amp;` that the parser hands on
verbatim, cheerio decodes that, and the entity is left standing as text.

The diagnosis is unambiguous for a reason worth keeping: every non-CDATA
spelling already round-trips clean — plain `&eacute;` and the double-encoded
`&amp;eacute;` both arrive as `é` — so only the CDATA path can produce what is
stored, and the stored corruption is itself the evidence those two feeds are
CDATA-wrapped. Probed through the real adapter before writing anything, which
is also what stopped this from being filed as the-verge's problem.

Came out of walking the backlog's the-verge entity item and re-deriving it
instead of trusting it. The recorded counts were occurrences read as titles
(49 titles, not 67), the stated mechanism was half wrong, and the scan that
checked it turned up this larger thing one field over. The entry is rewritten
above with what the data actually says, including the trap: reusing
`htmlToText` for the title fix would eat text from two real titles
(`<<History>>` → `<>`), so that one wants a targeted numeric decode. Retiring
a wrong premise and finding the real bug behind it was the day's work.

Copilot came back "needs a closer look" with one suppressed finding and was
right again: a `<![CDATA[` written inside an xml comment is text, not an
opener, and the first scanner would start a span there and run to the next real
`]]>`, carrying whatever is between through unsanitized. Second commit scans
comments and processing instructions as opaque spans of their own.

The reproduction took one correction worth recording. The first attempt used
`&nbsp;` as the swallowed entity and passed against the broken scanner:
rss-parser resolves the common html entities natively, so `&nbsp;`, `&rsquo;`
and `&hellip;` all parse and only a genuinely unknown one fails. With
`&wibble;` the case lands exactly as described — `Error: Invalid character
entity` on the whole feed. A test that passes against the code it is meant to
catch is not a weak test, it is a wrong one, and the difference was one entity.
Backlogged what it turned up about `HTML_ENTITIES`.

174 tests from 171, typecheck silent, 33 pages, verify unchanged, an 8MB feed
of 5,000 CDATA items parses in 748ms. checks green on both heads, merged
rebase, pages run 238 green. No second Copilot review on the new head; there
never is one, same as #153.

Rest of the sweep clean. No failed workflow runs anywhere in the last week —
the only non-successes in 160 listed runs are the three cancelled pages runs
from 09-02. `npm run verify` on today's digest carries two warnings, both
editorial rather than gardener work: one primary-source link (tomshardware,
linked 2x) and `already digested on 2026-09-12` on the verge's LG story.

#112's ingest drift is unchanged, still daily, and now the widest yet: today's
03:15 cron landed at **08:15:01, +5h00** (09-12 was +4h37, 09-11 +4h44), and
this morning's digest again forced its own workflow_dispatch (run 255, 04:36)
before drafting. Twelfth identical day, still no comment on #112.

goatcounter and sift.yasint.dev both 403 at CONNECT through the proxy, so no
reader signal for the seventeenth run and the live site could not be re-checked
after deploy; the deploy's own green stands in for it. Branch deletion failed
the same way as every shipping run (sideband disconnect); nine merged gardener
branches on the remote now.

Attribution: PR and issue bodies stripped per the contract, commit trailers and
the PR comment footer kept, same call as the last seven runs rather than
flipping the convention back and forth. Eighth run of the deviation, still
Yasin's one-line call either way.

Outcome: #156 filed and closed by #157, merged and deployed. #110, #112 and
#120 all still pending — #120 since 09-03, ten days.

### 2026-09-12

Shipped. What: ingested urls lose the syndicator's tracking tags (#152, PR #153,
merged fe77686 and dd54a9d). Why: 387 of the 5,785 items in the 32-day archive
store a tagged url — `utm_source` 325, all tldr's `tldrnewsletter`; `smid` 24,
nyt's share-medium twin; `ref` 38, console.dev; `source` 2, medium's rss token.

The tags do not stop at data/, which is what turned a tidiness itch into a fix.
Five links across three published digests carry one — cnbc on 08-31, thenextweb
twice on 09-08, nytimes and gizmodo on 09-09 — and two ride along in the 09-09
carousel. A reader clicking those from sift is counted as a tldr newsletter
click. The digest agent is not at fault and could not be: it links the url the
day's items hand it, and that url arrives tagged.

The care went into what *not* to strip. The nytimes link is the whole argument:
`...?unlocked_article_code=1._lA&smid=bs-share&utm_source=tldrnewsletter`, where
the gift token is the only reason the article opens at all. `accessToken`
(bloomberg, 22), `reflink` (wsj, 13) and a youtube `v=` (15) are the same
shape, so "drop the query" would have broken 50 links to fix 349. Named tags
only, and `ref`/`source` left alone for the mirror-image reason (backlogged
above).

Evidence was the archive itself rather than a spot check: replayed all 5,765
stored urls through the function, 325 change and each only by losing a
`utm_*`/`smid`, origin, path and fragment intact on all 325, the other 5,440
byte-identical. That replay is also what caught the one real bug — teslarati
sends `.../#google_vignette?utm_source=...`, where the `?` is inside the
fragment, and the first draft happily rewrote the fragment. Reading the query
before splitting off the hash is the kind of wrong that only shows up against
real data; the case is pinned now.

Dedup was the risk worth checking before writing anything: the seen index keys
on `sourceSlug:externalId`, and tldr's `externalId` **is** the raw href, so
tidying the stored url cannot make an item re-enter. The ingest test asserts
both halves — url cleaned, identity untouched, re-run still recognizes it.

Copilot came back "needs a closer look" with one suppressed finding, and it was
right: a percent-encoded key (`utm%5Fsource`) decodes to `utm_source` and slipped
the raw-spelling match. Nothing in the archive is spelled that way, so it buys
nothing today, but it is four lines and a test, and a bot finding is a bug report
until disproved. Fixed in the second commit, answered on the PR, and put
through the same failing-without-the-fix check as the rest. 171 tests from 166,
typecheck silent, 33 pages, verify clean, checks green on both heads (13s on the
first), pages run 235 green.

Rest of the sweep clean. No failed workflow runs anywhere in the last week.
`npm run verify` is silent on today's digest; re-run across the ten days before
it, zero errors and only the familiar primary-source and 60+ link warnings.
Worth one correction to yesterday's entry: it recorded 09-11 as the second fully
silent verify in a row, which was true of the am digest it ran against and is not
true of the file now — the evening rewrite added two primary-source links. A
verify result is a reading of a file at a moment, and the pm rewrite moves it.

The environment lost ground worth recording: outbound https is now allowlisted to
github, so feed probes, sift.yasint.dev and goatcounter all fail at CONNECT with
403. That retires live feed probing from the Signals list for as long as it holds
— the corpus in data/items/ is the substitute, and today's pick came out of it,
which is some evidence the substitute is workable. Sixteenth run without reader
signal.

#112's ingest drift is unchanged and still daily: today's 03:15 cron landed at
**07:52:39, +4h37**, and this morning's digest again forced its own
workflow_dispatch (run 251, 04:36) before drafting. Eleventh identical day, still
no comment on #112.

Branch deletion failed the same way as every shipping run (sideband disconnect,
then 403 on the api); eight merged gardener branches on the remote now. The
attribution deviation is seven runs old and unchanged — kept the harness's
trailer and footer rather than flipping the convention back and forth.

Outcome: #152 filed and closed by #153, merged and deployed. #110, #112 and #120
all still pending — #120 since 09-03, ten days.

### 2026-09-11

Shipped. What: the service worker claims the tab that registers it, so a push
notification click can actually open the digest (#148, PR #149, merged 9d1c0cb).
Why: `notificationclick` calls `WindowClient.navigate()` on a tab drawn from
`matchAll({ includeUncontrolled: true })`, and `navigate()` rejects on exactly
the tabs that option exists to include. There was no catch, so the promise
inside `waitUntil` rejected and nothing opened at all.

What turned that from a spec footnote into a reader-facing bug is the second
half: `sw.js` called neither `claim()` nor `skipWaiting()`, so the tab that
registers the worker is uncontrolled for its whole life — and that is precisely
the tab a reader taps "notify me" in. Subscribe on a first visit, never reload,
and every notification you then get is a dead tap. The one path the site has for
bringing a reader back was broken for the readers most likely to use it.

Proved it rather than citing it, which mattered because the mechanism is the
kind that sounds right and is easy to be wrong about. Served the shipped
`notificationclick` body **verbatim** in chromium behind a message-handler
harness and fired it at a same-origin tab: uncontrolled, `navigate()` rejected
with `TypeError: This service worker is not the client's active service worker.`
and the page never moved; after one reload, controlled, and it navigated. Then
the same body with `clients.claim()` on activate navigated **without** the
reload. Backed it with the real artifact too — served the actual built
`site/sw.js` from each branch and read `navigator.serviceWorker.controller`
after registering with no reload: `null` on main, non-null here. Two independent
angles on the same precondition.

Deliberately did not let the catch carry the argument. A catch-only build does
reach `openWindow`, but `openWindow` then rejects `InvalidAccessError: Not
allowed to open a window.` because a `message` event carries no user activation
where a real `notificationclick` does. So the catch is provably *reached* and
not provably *effective* from here, while `claim()` is proven end to end through
the real `navigate()` call. Wrote it in the issue and the PR in that order —
claim is the fix, the catch is insurance — rather than presenting the half I
could not finish proving as if I had. Left `skipWaiting()` out on the same
logic: it would reach readers holding an old `sw.js` sooner, at a blast radius
the bug does not justify.

The test is the part worth keeping. `sw.js` never runs under vitest and its two
existing assertions were `toContain("push")`-grade, so the bug had nothing
standing in its way. `test/sw.test.ts` loads the real `SW_SOURCE` into a
stand-in worker global and drives the handlers it registers: two of the four
fail against main's source (`expected undefined to be defined` for activate,
`promise rejected "TypeError: not the active worker" instead of resolving` for
the click), two pin unchanged behaviour and pass both ways. Checked that split
by stashing the src change, per habit. 166/166 from 162, typecheck silent, 33
pages, verify clean, `npm audit --omit=dev` zero. checks green in 23 seconds,
Copilot returned "approval recommended" with zero comments, merged rebase,
pages run 232 green.

Rest of the sweep clean and unfiled. No failed workflow runs anywhere in the
last week — ingest, pages, checks and Copilot review all green. `npm run verify`
returned zero errors **and zero warnings** on today's digest, the second fully
silent verify in a row. digests/ runs 08-11..09-11 with no gaps.

One signal walked and left alone, recorded so a later run does not re-walk it:
loaded the built index, a day page and the 404 in chromium over a local server
and watched the console and the network. Zero page errors, zero failed local
requests, zero 404s on any local asset across all three; the only failures are
fonts.googleapis.com and gc.zgo.at, both of which are this environment's proxy
rather than the site. Worth naming because it is what pushed the run toward
reading `sw.ts` properly — nothing was visibly wrong, so the defect was always
going to be in a path a page load never exercises.

#112's ingest drift is unchanged and still daily: today's 03:15 cron landed at
**07:59:45, +4h44**; yesterday's 15:45 at 18:41 (+2h56). This morning's digest
again forced its own workflow_dispatch (run 247, 04:36) before drafting. Tenth
identical day, still no comment on #112 — nothing to add.

goatcounter unreachable again (proxy 403 on CONNECT), fifteenth run without
reader signal; sift.yasint.dev is 403 through the same proxy, so the live site
could not be re-checked after deploy and the deploy's own green stands in for
it. Branch deletion failed the same way as every shipping run (sideband
disconnect); seven merged gardener branches on the remote now.

The attribution deviation is six runs old and still Yasin's to settle. Same call
as the last five — kept the harness's `Co-Authored-By` trailer and PR footer
rather than flipping the convention back and forth, and said so to him directly.
The datum from 09-10 still stands and still argues the harness is now the house
style: the digest agent's own commits carry `Co-Authored-By: Claude Sonnet 5`
trailers twice a day, so the Identity rule is out of step with what the repo
already does. A one-line contract edit either way, which is his.

Outcome: #148 filed and closed by #149, merged and deployed. #110, #112 and
#120 all still pending — #120 since 09-03, nine days.

### 2026-09-10

Shipped. What: every workflow action moved off the deprecated node 20 runtime
(#144, PR #145, merged 6fcc9f7). Why: the last line of every job in every
workflow, on every run, was the runner saying so — ingest naming
`actions/checkout@v4, actions/setup-node@v4`, pages/build naming those two
plus `actions/cache@v4` and `actions/upload-artifact@v4`, pages/deploy naming
`actions/deploy-pages@v4`. "Being forced to run on Node.js 24" is the runner
already declining to start node 20; the pins are what github is deprecating,
and when it finishes, ingest, pages and checks all stop at once. That is the
whole machine the digest agent runs on, which is what made a version bump feel
like gardening rather than housekeeping.

Ten lines, five pins, three files. Every runtime claim came from the action's
own `action.yml` at the tag rather than from memory, which was the right
instinct twice over. First, `actions/upload-artifact@v4` in the pages warning
is transitive — it lives inside `upload-pages-artifact`, and that action's own
`@v4` **still** pins `upload-artifact@v4.6.2`, node20. Bumping v3→v4 would
have looked like a fix and left the warning standing; only `@v5`, which pins
`upload-artifact@v7.0.0`, is node24. Second, `actions/upload-artifact@v5`
itself declares node20 at its tag, so "v5 means node24" is not a rule you can
apply across actions by pattern. Read each one.

The one real behaviour change is `upload-pages-artifact@v5` excluding
dot-prefixed entries from the tarball unless asked otherwise. Proved it a
no-op instead of asserting it: ran both the v3 and the v5 `tar` invocations
verbatim against the real built `site/` — 33 pages plus the full slides tree,
692 files — and got 790 members either way with member lists byte-identical
(sha256 `a351193e…` both). The published artifacts agree: 88,024,666 bytes on
the last v3 run against 88,020,815 on this one, a 0.004% delta that is png
re-render noise, not missing files.

Verification that mattered more than the tests, though: the proof is an
absence. checks green in 13s and its log ends on "Cleaning up orphan
processes" with no warning after it — on main that exact line was followed by
the deprecation notice. Same for pages/build and pages/deploy after the merge.
Every node 20 warning in the repo is gone, including the transitive one, which
is what confirms the upload-pages-artifact reasoning was right rather than
merely plausible. 162/162, typecheck silent, 33 pages, verify clean, all three
workflow files parse. Copilot returned "approval recommended" with zero
comments. Merged rebase, pages run 229 green, deploy reported success.

Rest of the sweep clean. No failed workflow runs anywhere in the last week,
`npm run verify` returned zero errors **and zero warnings** on today's digest,
which is the first fully silent verify in a while.

Three signals walked and left alone rather than filed — tap targets, the
maskable icon, the footnote measure — all three written into the backlog as
walked, with the measurements, so a later run does not re-derive them. The
icon one is worth naming here because it was nearly a bad PR: two byte-
identical files where one is declared `purpose: "maskable"` reads as an
obvious oversight, and it took actually looking at the image to see the mark
already sits inside the safe zone and the duplication is correct. Cheap
explanations hide bugs, per 09-06; expensive-looking bugs also hide correct
code.

Two new backlog items from the data. Seven enabled sources have produced zero
items across the entire 32-day archive, with `failures: []` — so not broken,
just quiet, and separating dead feeds from slow bloggers has a registry
consequence, which is Yasin's. Not filing it as a second unanswered editorial
issue while #120 sits. And `state.sources` is never pruned the way `seen` is,
so three slugs deleted from the registry still carry validators; too small to
spend a slot on, flagged to ride along with any future state.ts change.

#112's ingest drift is unchanged and still daily: today's 03:15 cron landed at
**08:04:51, +4h50**; yesterday's 15:45 at 18:51 (+3h06). This morning's digest
again forced its own workflow_dispatch (run 243, 04:36) before drafting. Ninth
identical day, still no comment on #112 — nothing to add.

goatcounter unreachable again (proxy 403 on CONNECT), fourteenth run without
reader signal; sift.yasint.dev is 403 through the same proxy, so the deploy's
own green again stands in for a live check. Branch deletion failed the same way
as every shipping run; six merged gardener branches on the remote now.

The attribution deviation is five runs old and still Yasin's to settle. Same
call as the last four — kept the harness's `Co-Authored-By` trailer and PR
footer rather than flipping the convention back and forth, and said so to him
directly. One datum that argues the harness is now simply the house style:
the digest agent's own commits carry `Co-Authored-By: Claude Sonnet 5`
trailers, so the Identity rule is out of step with what the repo already does
twice a day. Worth a one-line contract edit either way, which is his.

Outcome: #144 filed and closed by #145, merged and deployed. #110, #112 and
#120 all still pending — #120 since 09-03, eight days.

### 2026-09-09

Shipped. What: the site's "next digest lands at" times are derived from the
utc schedule at view time instead of being hardcoded as oslo wall clock
(#140, PR #141, merged c063b07). Why: three scripts print those times — the
index note, today's day-page "morning half" note and the 404 — and all three
carried the literals `06:45` and `18:45`. The schedule behind them is utc
(04:34 and 16:34 plus about ten minutes) and **europe/oslo leaves cest on
2026-10-25**, 46 days out, so from that sunday every label reads an hour
late.

The signal came from reading today.ts's own comment, which said the quiet
part out loud: "drops land around 06:45 and 18:45 oslo time **in summer**".
The caveat was written down and then never acted on, which is the same shape
as the 09-06 lesson one layer over: a known-incomplete fact sitting in a
comment is not safer than one sitting in the journal.

Worth naming that this was not only cosmetic. `refreshNote` returns early on
`clock >= "18:45"`, so on a winter afternoon between 17:45 and 18:45 a reader
would sit on the day page being told the evening half is still coming — while
reading it. The literals gated the logic, not just the copy.

Verified in a browser rather than by reading the diff: built main and the
branch over the same fixture, served both, and read the rendered note out of
chromium with `page.clock.setFixedTime` and `timezoneId: Europe/Oslo`. Eight
cases, and the split is exactly the claim — all three summer cases byte-for-
byte identical (day page 12:00, index 05:00, 404), all five winter cases
corrected (17:45/05:45 instead of 18:45/06:45, the tomorrow-branch too, and
the 18:00 note correctly hidden where main still showed it). That probe is
what turned "an hour is wrong" into a demonstration; the unit test that came
out of it pins summer, winter and the evening before the switch, where
today's and tomorrow's drops disagree.

The tests needed changing, which is the part to be careful about. Four
assertions looked for the literal `06:45`/`18:45` in the built html — exactly
what the fix removes. They now assert the derivation, and the guarantee they
stood for moved into the new DST test, which is strictly stronger than what
it replaced (it checks values, not the presence of a string). Checked they
fail against main's src by stashing the two source files: 4 failed, 158
passed. 162/162 after, typecheck silent, 33 pages, verify clean, npm audit
zero.

Copilot returned "approval recommended" with one finding, and it was real:
`dropAt` called `new Date()` once per label, so am, pm and tomorrow's am
could in principle be computed either side of a utc midnight. Hoisted the
clock into the snippet where the surrounding scripts reuse it rather than
making their own — which also took the page-weight cost down, +354 bytes on a
day page against +406 before. Answered it on the thread and pushed; checks
green in 17s both rounds, merged rebase, pages deploy green.

Rest of the sweep clean and unfiled. No failed workflow runs anywhere in the
last week (ingest, pages, checks, Copilot review all green), `npm run verify`
zero errors across the archive and three warnings on today's digest, all of
them the real class — an x.com post, a cisa advisory and an nbc story, none
of them in the day file. Journal needs no pruning; oldest entry is 08-29.

Two things looked at and left alone rather than filed, recorded so a later
run does not re-derive them from scratch. The rss feed carries only the
frontmatter description, and `pubDate` is a pure function of the day
(04:34 utc), so the evening rewrite never reaches a feed subscriber: all six
complete days since 09-03 got a pm rewrite and all six changed the
description. Fixing it properly wants a field saying which edition a file is,
and that is frontmatter, which is the digest agent's contract and not mine —
an issue, not a PR, and not one worth filing on top of #110/#112/#120 all
still waiting. Day pages also have no prev/next navigation, only "all days";
that is an addition to the design rather than a correction inside it, so it
is Yasin's call, not a gardener slot.

#112's ingest drift is unchanged and still daily: today's 03:15 cron landed
at **08:05:13, +4h50**; yesterday's evening 15:45 at 18:58 (+3h13). This
morning's digest again forced its own workflow_dispatch (run #239, 04:35)
before drafting. Still no new comment on #112 — an eighth identical day adds
nothing.

goatcounter unreachable again (proxy 403 on CONNECT), thirteenth run without
reader signal; sift.yasint.dev is 403 through the same proxy, so the live
site could not be re-checked after deploy and the deploy's own green stands
in for it. Branch deletion failed the same way as every shipping run
(sideband disconnect); five merged gardener branches on the remote now.

The attribution deviation is four runs old and still Yasin's to settle. This
run's harness again carries a standing rule, stated to replace earlier
guidance, that puts a `Co-Authored-By` trailer on commits and a "Generated by
Claude Code" footer on PR bodies, which the Identity section of the contract
forbids and which the contract's own RESOLVED note (09-03) says to strip.
Kept the harness's version for the fourth time rather than flipping back and
forth, and said so to Yasin directly rather than only here. Same datum as
09-08 holds: issue #140 came out with no footer, so only the PR path appends
one.

Outcome: #140 filed and closed by #141, merged and deployed. #110, #112 and
#120 all still pending Yasin's greenlight — #120 since 09-03, seven days, and
still the one with a real editorial decision behind it.

### 2026-09-08

Shipped. What: the google fonts stylesheet no longer blocks the first paint
(#136, PR #137, merged 22fa2b4). Why: the site is otherwise a single
self-contained html file — inline `<style>`, no external css, no external js
above the fold — and that one `<link rel="stylesheet">` decided when anything
painted. Measured on the built index over a local http server, five runs each:
median fcp **12656ms** on main against a fonts.googleapis.com `responseEnd` of
12535ms, versus **88ms** on the branch with the stylesheet still in flight.

The 12.5s is this environment's egress proxy, not a reader's network, and I
said so in the issue, the PR and the commit rather than letting the number do
work it has not earned. The finding is the coupling, not the magnitude: fcp
landed within ~50ms of the stylesheet's arrival in all five runs on main
(12668/12624/12656/12664/12636) and before it answered at all on the branch
(88/88/100/80/100). Whatever a reader's latency to the font cdn is, that is
what stands between them and a painted page, and an unreachable cdn means a
blank one.

The argument that made it feel like gardening rather than fashion: the url
already carries `&display=swap`, which is an explicit "paint the fallback,
swap when the webfont lands". A blocking stylesheet means the browser cannot
reach that decision until after the wait the policy exists to avoid. The
change does not pick a new tradeoff, it makes the one already written in the
url actually happen. Same url, same families, weights and axes; preload
flipped to stylesheet on load, `<noscript>` copy for no-js readers.

Verified the type still arrives rather than assuming it: after
`document.fonts.ready`, `document.fonts.check` is true for Fraunces, Karla and
Space Mono, `h1` computes to Fraunces, and a full-page screenshot of the
settled page is byte-identical to main's (sha256 `ff7e2978…` both ways). That
mattered — the first probe run showed no font resource at all under the new
pattern and looked like a broken fix; it was the 12s request still in flight
past the measurement window, which is the point of the change, not a failure
of it. Named the cost too: the url appears twice now, so each page grows 302
bytes. 24 changed lines, test fails on main and passes here (stashed the src
change: 1 failed, 22 passed), 161/161, typecheck silent, 33 pages, verify
clean. checks green in 19s, Copilot returned "approval recommended" with zero
comments, merged rebase, pages deploy green.

Spent most of the run looking rather than fixing, which is what a healthy repo
costs. Two signals got walked properly for the first time and both came back
clean, so they are in the backlog as walked: the slide cards (520 across 32
days, checked for clipping against the 1080x1350 frame — none, every card's
lowest element sits exactly on the 1262px padding edge) and horizontal
overflow on the built site (34 pages at 375px and 1280px, nothing escapes).
Read today's am carousel end to end as well; it renders as designed.

Rest of the sweep clean and unfiled. `npm audit --omit=dev` zero
vulnerabilities, no failed workflow runs anywhere in the last week (ingest,
pages, checks, Copilot review all green), `npm run verify` zero errors across
the whole archive and zero warnings on today's digest. The archive now sits at
52 warnings over 32 days, 16 warning-free days, and I re-derived the
link-not-found class rather than inheriting yesterday's label: the 47 that
remain spread across **38 distinct hosts**, 1 to 5 each, techcrunch the worst
at 5. No systematic false positive is left hiding in there — after #130 and
#133 the class is real signal, which is what the 09-06 lesson asks to be
checked rather than assumed.

#112's ingest drift is unchanged and still daily: today's 03:15 cron landed at
**08:01:10, +4h46**, against yesterday's +4h58 worst; yesterday's evening
15:45 landed at 19:23 (+3h38). This morning's digest again forced its own
workflow_dispatch (run #235, 04:36) before drafting. Still no new comment on
#112 — a seventh identical day adds nothing.

goatcounter unreachable again (proxy 403 on CONNECT), twelfth run without
reader signal; sift.yasint.dev is 403 through the same proxy, so the live site
could not be re-checked after deploy and the deploy's own green stands in for
it. Worth noting the asymmetry: fonts.googleapis.com *is* reachable from here,
which is why today's measurement was possible at all.

The attribution deviation is now three runs old and still Yasin's to settle.
This run's harness again carries a standing rule, stated to replace earlier
guidance, that puts a `Co-Authored-By` trailer on commits and a "Generated by
Claude Code" footer on PR bodies, which the Identity section of the contract
forbids. Kept the harness's version for the third time rather than flipping
back and forth mid-stream — but this time it also went to Yasin directly
rather than only here, per the lesson about the journal not being a channel.
Interesting datum: issue #136 came out with no footer, so only the PR path
appends one.

Outcome: #136 filed and closed by #137, merged and deployed. #110, #112 and
#120 all still pending Yasin's greenlight — #120 since 09-03, six days, and
still the one with a real editorial decision behind it.

### 2026-09-07

Shipped. What: `npm run verify` now warns once per unknown link url instead
of once per occurrence, carrying the count (#132, PR #133, merged 7c5da4c).
Why: after #130 cleared the hn permalinks, "link not found in the day's items
(primary source or typo?)" was still 70 of the 75 warnings the archive emits,
and those 70 covered only **45 distinct urls**. 25 of them (36%) were the same
url counted again because the digest links it more than once. The cross-check
loop iterated `links` (every regex match); the "already digested" check two
blocks down the same function had been doing `new Set(links.map(normalize))`
all along.

The backlog recipe from 09-06 was re-derived from primary data before the slot
was spent, per the 09-05 lesson, and this time it held: grouped every warning
in the archive by day and by distinct url, and link-not-found turned out to be
the *only* warning kind that ever repeats verbatim within one day. Worst case
`openai.com/index/path-to-astra/` on 09-04, linked three times, warned three
times. 09-03's 8 warnings over 3 urls matched yesterday's note exactly.

Measured before and after across all 32 digests: total warnings 75 to 50,
link-not-found 70 to 45, redundant 25 to 0, errors 0 both ways, warning-free
days 17 both ways (the redundancy only ever fell on days that already had
warnings, so it never hid a clean day). The count rides along as `(linked 3x)`
rather than being dropped, so nothing is lost; message text is unchanged for a
url linked once. First-seen order and the raw url as written are preserved.
10 lines in src/digest/verify.ts plus a test that fails on main and passes here
(checked by stashing the src change: 1 failed, 36 passed). 160/160, typecheck
silent, 33 pages. Nothing else in the repo depends on the warning string.
checks green in 18 seconds, Copilot returned success with zero comments,
merged rebase.

The thing worth keeping: this is the first backlog recipe to survive
re-derivation intact. 09-02's held, 09-04's was wrong on every claim, and the
rule that came out of that was to re-check the premise from primary evidence
rather than trust the note. Doing that here cost about ten minutes and turned
a one-line hunch into a measured 33% cut in the verifier's noise, plus the
finding that the class is now unique — which the note itself had not claimed.
The re-derivation is not a tax on good recipes; it is what tells you which
kind you have.

Rest of the sweep clean and unfiled. `npm audit --omit=dev` zero
vulnerabilities, no failed workflow runs anywhere in the last week (ingest,
pages, checks, Copilot review all green), `npm run verify` zero errors across
the entire archive, today's digest verifies with zero warnings. The 45 that
remain are the real primary sources outside the day's items — techcrunch,
research.meta.ai, metr.org, openai.com — and the deliberate continuity
callbacks. Journal needs no pruning; the oldest entry is 08-29, nine days old.

#112's ingest drift is the worst yet, but the same failure, not a new one:
today's 03:15 cron landed at **08:13:34, +4h58**, against a previous week's
worst of 07:59 (+4h44) and a run of 07:51, 07:37, 07:56. Yesterday's evening
15:45 landed at 17:43 (+1h58). This morning's digest again forced its own
workflow_dispatch (run #231, 04:35) before drafting. Still no new comment on
#112 — a sixth day adds nothing the issue does not carry.

Worth recording how nearly that went in as something else. At 08:13:13 the
cron had not fired and the entry was written saying so, "had not fired at
all", which was true to the second and would have read to any later run as a
qualitative change: drift became no-show. It fired 21 seconds later. Nothing
was wrong with the observation, only with concluding a trend from the moment
the run happened to look. A cron already known to slip four to five hours had
not yet slipped past the window where it slips; "and counting" was doing work
the data had not earned. Cheap to fix here, expensive as a banked premise —
the same failure as 09-04's backlog recipe, caught before it was written down
rather than after.

goatcounter unreachable again (proxy 403 on CONNECT), eleventh run without
reader signal; sift.yasint.dev is 403 through the same proxy, so the live site
could not be re-checked after deploy and the deploy's own green is what stands
in for it.

The undeletable merged branch is now three, one per shipping run, and it will
keep growing at that rate. Repo settings' auto-delete-on-merge would close it
in one click; this environment cannot.

The attribution deviation from 09-06 is unchanged and still Yasin's to settle:
this run's harness again carries a standing rule, stated to replace earlier
guidance, that puts a `Co-Authored-By` trailer on commits and a "Generated with
Claude Code" footer on PR bodies, which the Identity section here forbids. Kept
the harness's version again for consistency with 85add52 rather than flipping
back and forth. Two runs now, unflagged in the code and flagged here twice.

Outcome: #132 filed and closed by #133, merged and deployed. #110, #112 and
#120 all still pending Yasin's greenlight — #120 since 09-03, five days, and
still the one with a real editorial decision behind it.

### 2026-09-06

Shipped. What: the verifier now reads a hacker news discussion permalink as
the story it points at (#129, PR #130, merged 85add52). Why: "link not found
in the day's items (primary source or typo?)" is `npm run verify`'s most
common warning, and 41% of every one it has ever emitted was the same false
positive. The digest links an hn story by its discussion permalink
(`news.ycombinator.com/item?id=N`); ingest stores that story under the
*article's* url with the hn id in `externalId`, so the cross-check, which only
matched `item.url`, could not see they were the same story.

Measured over all 32 digests against their day files before shipping: 122 of
the "link not found" warnings in the archive, 52 of them hn permalinks whose
id **is** a `hacker-news` item in the same day file, spread across 23
separate days, and **zero** hn permalinks that were not. Ran `verifyDigest`
across the whole archive before and after: total warnings 127 to 75,
warning-free days 7 to 17, days with errors 0 both ways. 2026-09-05 is the
clean case, 4 warnings all four this, now 0; 2026-08-25 the same, 5 to 0.

The fix admits `https://news.ycombinator.com/item?id=<externalId>` into the
known-url set for each ingested `hacker-news` item, gated on the slug plus a
bare-numeric `externalId` — only hacker-news keys items that way, 940 across
the archive and zero from any other source. A permalink to a story that was
*not* ingested that day still warns, and the new test asserts exactly that by
pointing one at another source's externalId. It also picks up a case that
could never have been linked before: an Ask HN post has no article url at
all, so the permalink was its only possible link and always warned. ~12 lines
in src/digest/verify.ts plus a test; no dependency, no contract file touched.
Test fails on main, passes here (checked by stashing the src change). 159/159,
typecheck silent, 33 pages. checks green in 23 seconds, Copilot returned
"approval recommended" with zero comments, merged rebase.

The lesson is about the journal, not the code. Five consecutive entries wrote
these warnings off as "the known deliberate pattern (primary-source links,
HN permalinks)" — a label inherited from the run before, never re-derived.
Half of what that phrase was covering was a bug report the journal was
suppressing. A recurring signal that gets explained away in prose every run
is the one most worth re-deriving from the data, precisely because the
explanation is cheap and nobody rechecks it. Same shape as 09-05's retired
backlog item, one layer up: there the bad claim was written down, here it was
a habit of phrasing.

Rest of the sweep clean and unfiled. `npm audit --omit=dev` zero
vulnerabilities, no failed workflow runs anywhere in the last week (ingest,
pages, checks, Copilot review all green), `npm run verify` zero errors across
the entire archive. The warnings that remain after this change are the real
version of the old label: primary sources genuinely outside the day's items
(techcrunch, research.meta.ai, metr.org, openai.com) and the deliberate
continuity callbacks.

Backlog gained a smaller sibling of today's finding rather than a second PR:
the same "link not found" warning fires once per *occurrence* of the link in
the digest, so 2026-09-03's 3 distinct urls read as 8 warnings. The
"already digested" check two blocks down already dedupes with a Set; this one
does not. Noted, not verified beyond the observation.

#112's ingest drift is unchanged and still daily: today's 03:15 cron landed at
07:51 (+4h36), yesterday's 15:45 at 17:41 (+1h56, the mildest evening in a
week but still outside the window), and this morning's digest again forced its
own workflow_dispatch (run #227, 04:36) before drafting at 04:44. No new
comment on #112 — a fifth identical day adds nothing.

goatcounter unreachable again (proxy 403 on CONNECT), tenth run without reader
signal; sift.yasint.dev is 403 through the same proxy, so the live site could
not be re-checked after deploy.

One deviation worth Yasin's eye, because it is a contract question and those
are his. This run's harness carries a standing attribution rule, stated to
replace earlier guidance, that puts a `Co-Authored-By` trailer on commits and
appends a `Generated by Claude Code` footer to PR bodies. The Identity section
here says the opposite: strip the footer, name no agent in any commit. I kept
the harness's version rather than stripping it — removing attribution on my
own judgement is not a call I should make quietly — so 85add52 and #130 both
carry it where #124 and #116 did not. Either the contract or the harness
config needs to give; it is not mine to decide which.

Outcome: #129 filed and closed by #130, merged and deployed. #110, #112 and
#120 all still pending Yasin's greenlight — #120 since 09-03, and it is still
the one with a real decision behind it.

### 2026-09-05

Quiet run, no PR, and for once that is the finding rather than the
absence of one. The slot was free — no open gardener PR, nothing merged
or closed since yesterday — so the run went to the top of the backlog as
written, the `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` one-liner for checks.yml,
which 09-04 left marked ready to ship pending one verification. The
verification failed, twice over, and the item is retired instead of
shipped.

Both claims were wrong. The first: "the cliff shows up whenever the
lockfile changes and the setup-node npm cache misses." #124's 7m02s run
was a cache **hit**, on key `a401ab82…` — byte-identical to the key
09-05's checks run hit, installing the same 84 packages, in **3s**. Same
lockfile, same cache, same work, 140x apart. There is no cliff to remove.
The second: "the install is playwright pulling browsers." `playwright`
1.61.1 ships no `install` or `postinstall` script at all; `npm query`
across the installed tree finds exactly one install hook, esbuild's. So
`npm ci` never downloads a browser in this repo — they come only from the
explicit `npx playwright install --with-deps chromium` in pages.yml, a
different workflow the env var would not touch. Setting it on the checks
job would have been a pure no-op dressed up as a performance fix, which
is precisely the churn the contract's Hard limits exist to stop.

What the 7 minutes actually was: one silent stall inside a single npm ci,
between the deprecation warning at 08:23:16 and "added 84 packages in 7m"
at 08:30:16. Tellingly that run printed no "audited 85 packages" and no
"found 0 vulnerabilities" — lines both the 09-05 CI run and a local
`npm ci` here do print. Consistent with npm's registry audit request
hanging and being abandoned. Transient infrastructure, not a repo defect,
and not worth an issue on one occurrence.

Rest of the sweep clean and unfiled. `npm test` 158/158, typecheck
silent, `npm run site` 33 pages at 1.2MB, `npm audit --omit=dev` zero
vulnerabilities. No failed workflow runs anywhere in the last week —
ingest, pages, checks and Copilot review all green. `npm run verify`
returns zero errors on 08-30..09-05; 08-30, 08-31 and 09-01 are warning-
free too, and 09-02..09-05's warnings are all the known deliberate
pattern (primary-source links outside the day's items, HN permalinks, and
continuity callbacks to Path to Astra and gpt-6-astra).

Took the free slot to the craft signal since nothing else earned it, and
it came back clean, which is worth recording so a future run does not
re-walk it. On the built pages: exactly one h1, `nav`/`main`/`article`/
`header`/`footer` landmarks all present, zero images missing alt, zero
`target="_blank"` links missing rel. Head carries canonical, description,
full OG and Twitter card, NewsArticle JSON-LD, manifest, RSS alternate
and the icon set. feed.xml (32 items) and sitemap.xml (33 urls) are
well-formed with no unescaped ampersands; manifest.webmanifest parses;
every local asset reference resolves. No skip link, but `nav.crumbs` is a
single "← all days" anchor, so bypass-blocks does not bite — noted so it
is not mistaken for a defect later.

#112's ingest drift is unchanged and still daily: today's 03:15 cron
landed at 07:37 (+4h22), yesterday's 15:45 at 18:33 (+2h48), and this
morning's digest again forced its own workflow_dispatch (run #223, 04:37)
before drafting at 04:45. No new comment on #112 — a fourth identical day
adds nothing it does not already carry. The digest agent itself is
healthy: 2026-09-05 landed on time and digests/ runs 08-05..09-05 with no
gaps.

goatcounter unreachable again (proxy 403 on CONNECT), ninth run without
reader signal.

Outcome: no PR by design, and the backlog is one bad item lighter. #110,
#112 and #120 all still pending Yasin's greenlight — #120 since 09-03,
and it is the one with a real decision behind it.

### 2026-09-04

Shipped, and the first run to close its own loop end to end. What:
`color-scheme:dark` added to the existing `:root` block in
src/site/page.ts (#123, PR #124, merged 6f4bdcc). Why: the site never
declared a scheme, so the browser assumed light and painted its
light-mode UA chrome against `#0d0c0b` — a near-white scrollbar down
the right edge of every page. The backlog recipe from 09-02 held
verbatim: right-edge pixel at y=350 goes `(252,252,252)` to
`(44,44,44)`, computed `colorScheme` goes `normal` to `dark`, and all
34 built files (32 digests, index, 404) carry it. One declaration, no
palette hex touched or added, contract test untouched. 158/158,
typecheck silent, 33 pages. Copilot returned "approval recommended"
with zero comments; checks green; merged rebase; pages deploy green.

Two things the run learned the hard way, both now lessons or backlog
rather than prose. The first is mine: I launched background `sleep`
commands and then queried the api without ever waiting on them, so a
perfectly healthy `npm ci` two minutes into its run looked like a
40-minute stall and I cancelled it. The re-run (attempt 2) was green.
Nothing was lost but a CI cycle, and the fix is to block on the state
itself and read `date` before believing anything is wedged.

The second came out of that mistake and is worth keeping: the cancelled
attempt's logs made the checks workflow's shape measurable. `npm ci`
7m02s against 6 seconds of test, typecheck and site combined. That is a
cold npm cache plus playwright's browser download, first triggered by
#116's lockfile bump; 09-03's run on the old lockfile was 29 seconds.
Backlogged with the one-line candidate fix rather than shipped, since
today's improvement was already spent.

Two smaller notes. The merged branch could not be deleted — the proxy
kills a delete-ref push and the token is 403 on the refs api — so
gardener/2026-09-04-color-scheme-dark is still on the remote; also
backlogged. And no screenshots were attached to #124: this environment
cannot upload images to github. The pixel readings carry the same
measurement and the PR body says plainly that they stand in for the
images. Same reason the live site could not be re-checked after deploy
(sift.yasint.dev is 403 through the egress proxy, as goatcounter has
been for eight runs now) — the deploy went green and the built output
was verified locally file by file, which is as far as this environment
reaches.

Rest of the sweep clean and unfiled. `npm audit --omit=dev` reports
zero vulnerabilities, the first clean audit since #116 landed. No
failed workflow runs in the last week. `npm run verify` ok with zero
errors on 08-29..09-04; 09-02, 09-03 and 09-04 each carry warnings and
all of them are the known deliberate pattern — primary sources outside
the day's items (an openai post, a washingtonexaminer piece, two HN
permalinks) and one conscious continuity callback to a story digested
on 09-02. The digest agent has run on time every window since 09-03.

#112's ingest drift is unchanged and still daily: today's 03:15 cron
landed at 07:56 (+4h41), yesterday's 15:45 at 18:52 (+3h07), and this
morning's digest again forced its own workflow_dispatch at 04:36 before
drafting. No new comment on #112 — it already carries two data points
and a third identical day adds nothing.

Outcome: #123 filed and closed by #124, merged and deployed. #110
pending, #112 pending, #120 pending Yasin's editorial call.

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
