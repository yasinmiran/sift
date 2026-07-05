import { PUSH_URL, VAPID_PUBLIC_KEY } from "./page";

// iOS Safari only exposes PushManager to installed home-screen apps, so its
// absence gets the install hint rather than a dead button. All failures
// degrade silently back to the idle state.
export function notifyBlock(): string {
  return `<p id="notify" class="notify" hidden></p>
<script>
(() => {
  const slot = document.getElementById("notify");
  if (!("serviceWorker" in navigator)) return;
  if (!("PushManager" in window)) {
    slot.textContent = "install sift to your home screen to get notified of new digests.";
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
  slot.append(btn);
  const render = (sub) => {
    btn.textContent = sub ? "notifications on \\u00b7 tap to stop" : "notify me on new digests";
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
