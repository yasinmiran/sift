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
(() => {${DROP_TIMES}
  const m = /(\\d{4}-\\d{2}-\\d{2})\\.html$/.exec(location.pathname);
  if (!m) return;
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Oslo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  if (m[1] !== day) return;
  const clock = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Oslo", hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
  if (clock >= PM || clock < AM) return;
  const left = minsOf(PM) - minsOf(clock);
  const when = left <= 60 ? "in under an hour" : "in about " + Math.round(left / 60) + " hours";
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
        if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
          slot.hidden = true;
          return;
        }
        slot.classList.add("draining");
        setTimeout(() => { slot.style.opacity = "0"; }, 5500);
        setTimeout(() => { slot.hidden = true; }, 6200);
      })
      .catch(() => {});
  }
})();
</script>`;
}
