import { PUSH_URL, VAPID_PUBLIC_KEY } from "./page";

const BELL_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>';
const INSTALL_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
const CHECK_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';

// iOS Safari only exposes PushManager to installed home-screen apps, so its
// absence gets the install hint rather than a dead button. All failures
// degrade silently back to the idle state. The install button appears only
// when the browser offers beforeinstallprompt and the app is not standalone.
export function notifyBlock(): string {
  return `<p id="notify" class="notify" hidden></p>
<script>
(() => {
  const slot = document.getElementById("notify");
  if (!("serviceWorker" in navigator)) return;
  const label = (icon, text) => icon + "<span>" + text + "</span>";
  if ("onbeforeinstallprompt" in window && !matchMedia("(display-mode: standalone)").matches) {
    const install = document.createElement("button");
    install.className = "notify-btn";
    install.innerHTML = label(${JSON.stringify(INSTALL_ICON)}, "install app");
    install.hidden = true;
    slot.append(install);
    let deferred = null;
    const markInstalled = () => {
      install.innerHTML = label(${JSON.stringify(CHECK_ICON)}, "installed");
      install.disabled = true;
      install.hidden = false;
      slot.hidden = false;
    };
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferred = e;
      install.hidden = false;
      slot.hidden = false;
    });
    window.addEventListener("appinstalled", markInstalled);
    if ("getInstalledRelatedApps" in navigator) {
      navigator.getInstalledRelatedApps().then((apps) => { if (apps.length) markInstalled(); }).catch(() => {});
    }
    install.addEventListener("click", async () => {
      if (!deferred) return;
      deferred.prompt();
      const choice = await deferred.userChoice.catch(() => null);
      deferred = null;
      if (choice && choice.outcome === "accepted") markInstalled();
      else install.hidden = true;
    });
  }
  if (!("PushManager" in window)) {
    slot.insertAdjacentText("afterbegin", "install sift to your home screen to get notified of new digests.");
    slot.hidden = false;
    return;
  }
  const b64ToBytes = (b64) => {
    const pad = "=".repeat((4 - (b64.length % 4)) % 4);
    const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(raw, (c) => c.charCodeAt(0));
  };
  const btn = document.createElement("button");
  btn.className = "notify-btn";
  slot.prepend(btn);
  const render = (sub) => {
    btn.innerHTML = label(${JSON.stringify(BELL_ICON)}, sub ? "notifications on \\u00b7 tap to stop" : "notify me");
    slot.hidden = false;
  };
  const ready = navigator.serviceWorker.ready;
  ready.then((reg) => reg.pushManager.getSubscription()).then(render).catch(() => {});
  btn.addEventListener("click", async () => {
    try {
      const reg = await ready;
      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        await fetch("${PUSH_URL}/subscribe", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: existing.endpoint }) });
        await existing.unsubscribe();
        render(null);
        return;
      }
      if ((await Notification.requestPermission()) !== "granted") return;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes("${VAPID_PUBLIC_KEY}") });
      const res = await fetch("${PUSH_URL}/subscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(sub) });
      if (!res.ok) throw new Error("subscribe failed");
      render(sub);
    } catch {
      const sub = await (await ready).pushManager.getSubscription().catch(() => null);
      if (sub) await sub.unsubscribe().catch(() => {});
      render(null);
    }
  });
})();
</script>`;
}
