import { page, SITE_DESCRIPTION } from "./page";
import { DROP_TIMES } from "./today";

// GitHub Pages serves 404.html for every missing path, most often a day page
// that is not written yet (linked as "today") or one pruned from the rolling
// month. The script tells those two apart from the requested path.
export function notFoundPage(): string {
  const body = `
      <nav class="crumbs"><a href="/">&larr; all days</a></nav>
      <header class="head"><div><h1>404<span class="dot">.</span></h1><p class="tag">nothing sifted here</p></div></header>
      <main>
      <section id="why" class="today-note">this page does not exist. head back to <a href="/">all days</a>.</section>
      </main>
<script>
(() => {${DROP_TIMES}
  const m = /^\\/(\\d{4}-\\d{2}-\\d{2})\\.html$/.exec(location.pathname);
  if (!m) return;
  const day = m[1];
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Oslo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const why = document.getElementById("why");
  why.innerHTML = day >= today
    ? "the <strong>" + day + "</strong> digest is not sifted yet. digests land around <strong>" + AM + "</strong> and <strong>" + PM + "</strong> Oslo time; <a href=\\"/\\">read the recent days</a> meanwhile."
    : "the <strong>" + day + "</strong> digest rolled out of the month archive; it lives on in <a href=\\"https://github.com/yasinmiran/sift/commits/main/digests\\">git history</a>.";
})();
</script>`;
  return page(
    { title: "sift: page not found", description: SITE_DESCRIPTION, path: "404.html", type: "website", noindex: true },
    body,
  );
}
