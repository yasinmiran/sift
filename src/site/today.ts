// The two drops as Oslo wall clock, derived when the page is read rather
// than when it is built. The schedule is UTC — the digest routine runs 04:34
// and 16:34 and takes about ten minutes, so a drop lands 04:45 / 16:45 UTC
// rounded to the quarter hour — but Oslo is UTC+2 from late March and UTC+1
// from late October, so a literal "18:45" in the html goes an hour stale
// every autumn on a site that is built once and read for months. AM_NEXT is
// tomorrow's morning drop, which differs from AM on the evening before a
// switch. Shared by the index note, the day-page note and the 404 page.
// One `now` for all three, so they cannot land on either side of a UTC
// midnight and disagree about which day they describe; it doubles as the
// clock the surrounding scripts read.
export const DROP_TIMES = `
  const now = new Date();
  const dropAt = (h, m, ahead) => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Oslo", hour: "2-digit", minute: "2-digit", hour12: false })
    .format(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + (ahead || 0), h, m)));
  const minsOf = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  const AM = dropAt(4, 45), PM = dropAt(16, 45), AM_NEXT = dropAt(4, 45, 1);`;

// How long until the evening drop, in words. The count is computed in the
// browser and a count of one is not a plural: `Math.round(left / 60)` with
// " hours" glued on reads "in about 1 hours" for every `left` from 61 to 89
// minutes, which is 17:16 to 17:44 Oslo on every day whose morning half is
// live. The sentence already spells one the other way a clause earlier, so
// the singular says it the same. Its own snippet so the test runs this
// arithmetic rather than a copy of it.
export const TIME_LEFT = `
  const timeLeft = (left) => {
    const hours = Math.round(left / 60);
    return left <= 60 ? "in under an hour" : hours === 1 ? "in about an hour" : "in about " + hours + " hours";
  };`;

// Retiring the half-day note takes its whole box out of the flow above the
// digest, 147px plus 1.4rem of margin, so doing it while the note is on
// screen moves every line the reader is looking at: `.prose` jumps up 169px
// and scores 0.1220 of layout shift at 390px wide (0.1212 / 0.1067 / 0.0657
// at 360 / 430 / 860), one entry naming `.prose` as its only source. That is
// the whole of a day page's shift budget, since the page scores 0.0000 with
// the webfonts aborted, and it lands on the readers who opted in: the push
// notification opens `/{day}.html` inside this note's own window.
//
// Off screen the same collapse is free, measured 0 shifts at scrollY 400 and
// 900, because the browser takes the vacated height off the scroll offset
// (400 -> 231) and the line under the reader's eye does not move. So the note
// waits for the first scroll that carries it out of view. Where scroll
// anchoring is absent the rAF does the same subtraction by hand, before the
// frame paints and only if the browser has not already done it; `scrollY`
// cannot be 0 once the note is above the viewport, so the guard is belt.
// Its own snippet so the test drives this logic rather than a copy of it.
export const RETIRE_NOTE = `
  const retireWhenPast = (slot, w) => {
    const past = () => slot.getBoundingClientRect().bottom <= 0;
    const retire = () => {
      const y = w.scrollY;
      const h = slot.offsetHeight + (parseFloat(w.getComputedStyle(slot).marginTop) || 0);
      slot.hidden = true;
      w.requestAnimationFrame(() => { if (w.scrollY === y && y > 0) w.scrollTo(0, Math.max(0, y - h)); });
    };
    if (past()) return retire();
    const onScroll = () => { if (past()) { w.removeEventListener("scroll", onScroll); retire(); } };
    w.addEventListener("scroll", onScroll, { passive: true });
  };`;

// A subscribed reader is told about the evening update twice, so the note has
// done its job and retires. The drain bar is the only part of that a
// reduced-motion reader skips: the collapse itself still waits for the note to
// leave the viewport, because taking its box out of the flow on screen moves
// `.prose` up 169px and scores 0.1227 of layout shift at 390px (0.1212 /
// 0.1062 / 0.0659 at 360 / 430 / 860), which is the shift the scroll gate
// above exists to prevent. Routing both ways through retireWhenPast is also
// what keeps that gate's invariant true of the whole file rather than of one
// branch. Its own snippet so the test drives this decision rather than a copy.
export const RETIRE_FOR_SUBSCRIBER = `
  const retireForSubscriber = (slot, w, reduced) => {
    if (reduced) return retireWhenPast(slot, w);
    slot.classList.add("draining");
    w.setTimeout(() => retireWhenPast(slot, w), 6200);
  };`;

// Visitors clicking "read today's digest" land on the index with ?today=1.
// The site is static, so today's page may not exist yet; decide client-side:
// jump to it when it is in the list, otherwise say when the next one lands.
export function todayScript(): string {
  return `<script>
(() => {${DROP_TIMES}
  const oslo = (t) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Oslo", year: "numeric", month: "2-digit", day: "2-digit" }).format(t);
  const day = oslo(now);
  const yesterday = oslo(new Date(now.getTime() - 864e5));
  for (const el of document.querySelectorAll("[data-day]")) {
    const label = el.dataset.day === day ? "today" : el.dataset.day === yesterday ? "yesterday" : "";
    if (label) el.querySelector(".when").textContent = label;
  }
  const clock = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Oslo", hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
  const todayLink = document.querySelector('main a[href="' + day + '.html"]');
  if (todayLink) {
    if (new URLSearchParams(location.search).has("today")) location.replace(todayLink.getAttribute("href") + location.search);
    return;
  }
  const next = clock < AM ? "around " + AM + " today" : clock < PM ? "around " + PM + " today" : "around " + AM_NEXT + " tomorrow";
  const slot = document.getElementById("today");
  slot.innerHTML = "today's digest is still being sifted. the next one lands <strong>" + next + "</strong> (Oslo time); the bell above can ping you in case, or read the recent days below.";
  slot.hidden = false;
})();
</script>`;
}

// Today's day page is only half a day until the evening run; tell readers
// when the other half lands. No-op on past days and after the evening drop.
export function refreshNote(): string {
  return `<p id="refresh-note" class="today-note refresh-note" hidden></p>
<script>
(() => {${DROP_TIMES}${TIME_LEFT}${RETIRE_NOTE}${RETIRE_FOR_SUBSCRIBER}
  const m = /(\\d{4}-\\d{2}-\\d{2})\\.html$/.exec(location.pathname);
  if (!m) return;
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Oslo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  if (m[1] !== day) return;
  const clock = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Oslo", hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
  if (clock >= PM || clock < AM) return;
  const left = minsOf(PM) - minsOf(clock);
  const when = timeLeft(left);
  const local = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(now.getTime() + left * 60000));
  const yours = local === PM ? "" : ", around <strong>" + local + "</strong> your time";
  const slot = document.getElementById("refresh-note");
  slot.innerHTML = "this is the morning half of the day. the evening update lands <strong>around " + PM + "</strong> (Oslo time), " + when + yours + "; notifications ping you in case you have them on.";
  slot.hidden = false;
  if ("PushManager" in window) {
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (!sub) return;
        retireForSubscriber(slot, window, matchMedia("(prefers-reduced-motion: reduce)").matches);
      })
      .catch(() => {});
  }
})();
</script>`;
}
