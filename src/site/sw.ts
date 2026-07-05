// Service worker source, emitted verbatim as /sw.js by the site build.
// Push-only by design: no fetch handler, the site stays plain static.
export const SW_SOURCE = `self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(self.registration.showNotification(data.title || "sift", {
    body: data.body || "a new digest is up",
    icon: "/favicons/icon-192.png",
    data: { url: data.url || "/" },
  }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((tabs) => {
    const tab = tabs.find((t) => new URL(t.url).origin === self.location.origin);
    return tab ? tab.navigate(url).then((w) => w && w.focus()) : self.clients.openWindow(url);
  }));
});
`;
