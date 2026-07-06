import { PUSH_URL, VAPID_PUBLIC_KEY } from "./page";

const BELL_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>';
const INSTALL_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
const CHECK_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';
const SPIN_ICON =
  '<svg class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.2-8.56"/></svg>';

// iOS Safari only exposes PushManager to installed home-screen apps, so its
// absence gets the install hint rather than a dead button. All failures
// degrade silently back to the idle state. The install button appears only
// when the browser offers beforeinstallprompt and the app is not standalone.
export function notifyBlock(): string {
  return `<p id="notify" class="notify" hidden></p>
<dialog id="install-help" class="install-help">
<h2>get sift on your home screen</h2>
<ol>
<li>tap the share button in your browser's toolbar</li>
<li>choose "Add to Home Screen" (in chrome it can sit further down the share sheet)</li>
<li>open sift from the new home screen icon</li>
<li>tap the bell there to turn on notifications</li>
</ol>
<p class="help-note">on iphone, notifications only work from the installed app, never from a browser tab; that is an apple rule, not ours.</p>
<button id="install-help-close" class="notify-btn">got it</button>
</dialog>
<script>
(() => {
  const slot = document.getElementById("notify");
  if (!("serviceWorker" in navigator)) return;
  const label = (icon, text) => icon + "<span>" + text + "</span>";
  const standalone = matchMedia("(display-mode: standalone)").matches;
  if (standalone || "onbeforeinstallprompt" in window) {
    const install = document.createElement("button");
    install.className = "notify-btn";
    install.innerHTML = label(${JSON.stringify(INSTALL_ICON)}, "install app");
    install.hidden = true;
    slot.append(install);
    let deferred = null;
    // localStorage remembers the install across tab visits. Two guards keep
    // it from lying after an uninstall: beforeinstallprompt (the browser's
    // authoritative "not installed") clears it, and the stamp decays after
    // 7 days unless a launch of the installed app refreshes it.
    const FLAG = "sift-installed";
    const FLAG_TTL = 7 * 864e5;
    const flag = (on) => { try { on ? localStorage.setItem(FLAG, String(Date.now())) : localStorage.removeItem(FLAG); } catch {} };
    const hasFlag = () => {
      try {
        const at = Number(localStorage.getItem(FLAG));
        return at > 0 && Date.now() - at < FLAG_TTL;
      } catch { return false; }
    };
    const markInstalled = () => {
      flag(true);
      install.innerHTML = "<span>installed</span>" + ${JSON.stringify(CHECK_ICON)};
      install.disabled = true;
      install.hidden = false;
      slot.hidden = false;
    };
    if (standalone) {
      markInstalled();
    } else {
      if (hasFlag()) markInstalled();
      window.addEventListener("beforeinstallprompt", (e) => {
        e.preventDefault();
        flag(false);
        deferred = e;
        install.innerHTML = label(${JSON.stringify(INSTALL_ICON)}, "install app");
        install.disabled = false;
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
  }
  if (!("PushManager" in window)) {
    const hint = document.createElement("button");
    hint.className = "notify-hint";
    hint.textContent = "install sift to your home screen (share, then add to home screen) to get notified of new digests.";
    slot.prepend(hint);
    const help = document.getElementById("install-help");
    hint.addEventListener("click", () => help.showModal());
    document.getElementById("install-help-close").addEventListener("click", () => help.close());
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
    btn.innerHTML = sub
      ? ${JSON.stringify(BELL_ICON)} + "<span>on</span>" + ${JSON.stringify(CHECK_ICON)}
      : label(${JSON.stringify(BELL_ICON)}, "notify me");
    btn.title = sub ? "tap to stop notifications" : "get a push when a new digest lands";
    slot.hidden = false;
  };
  const ready = navigator.serviceWorker.ready;
  ready.then((reg) => reg.pushManager.getSubscription()).then(render).catch(() => {});
  btn.addEventListener("click", async () => {
    if (btn.disabled) return;
    btn.disabled = true;
    btn.classList.add("busy");
    const span = btn.querySelector("span");
    btn.innerHTML = label(${JSON.stringify(SPIN_ICON)}, span ? span.textContent : "");
    try {
      const reg = await ready;
      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        await fetch("${PUSH_URL}/subscribe", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: existing.endpoint }) });
        await existing.unsubscribe();
        render(null);
        return;
      }
      if ((await Notification.requestPermission()) !== "granted") {
        render(null);
        return;
      }
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes("${VAPID_PUBLIC_KEY}") });
      const res = await fetch("${PUSH_URL}/subscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(sub) });
      if (!res.ok) throw new Error("subscribe failed");
      render(sub);
    } catch {
      const sub = await (await ready).pushManager.getSubscription().catch(() => null);
      if (sub) await sub.unsubscribe().catch(() => {});
      render(null);
    } finally {
      btn.disabled = false;
      btn.classList.remove("busy");
    }
  });
})();
</script>`;
}
