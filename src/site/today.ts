// Visitors clicking "read today's digest" land on the index with ?today=1.
// The site is static, so today's page may not exist yet; decide client-side:
// jump to it when it is in the list, otherwise say when the next one lands
// (digests are written around 06:00 and 18:30 Europe/Oslo).
export function todayScript(): string {
  return `<script>
(() => {
  const now = new Date();
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Oslo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const clock = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Oslo", hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
  const todayLink = document.querySelector('.days a[href="' + day + '.html"]');
  if (todayLink) {
    if (new URLSearchParams(location.search).has("today")) location.replace(todayLink.getAttribute("href") + location.search);
    return;
  }
  const next = clock < "06:00" ? "around 06:00 today" : clock < "18:30" ? "around 18:30 today" : "around 06:00 tomorrow";
  const slot = document.getElementById("today");
  slot.innerHTML = "today's digest is still being sifted. the next one lands <strong>" + next + "</strong> (Oslo time); come back then, or read the recent days below.";
  slot.hidden = false;
})();
</script>`;
}
