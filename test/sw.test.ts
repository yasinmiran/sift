import { describe, expect, it, vi } from "vitest";
import { SW_SOURCE } from "../src/site/sw";

// sw.js never runs under vitest, so drive the real source in a stand-in
// worker global: the handlers it registers are what the assertions call.
type Handler = (event: Record<string, unknown>) => void;

function loadWorker(clients: Record<string, unknown>): Record<string, Handler> {
  const handlers: Record<string, Handler> = {};
  const worker = {
    addEventListener: (type: string, fn: Handler) => {
      handlers[type] = fn;
    },
    location: { origin: "https://sift.yasint.dev" },
    registration: { showNotification: vi.fn(() => Promise.resolve()) },
    clients,
  };
  new Function("self", SW_SOURCE)(worker);
  return handlers;
}

function clickEvent(url?: string) {
  const waited: Promise<unknown>[] = [];
  return {
    notification: { close: vi.fn(), data: url ? { url } : undefined },
    waitUntil: (p: Promise<unknown>) => void waited.push(p),
    settled: () => Promise.all(waited),
  };
}

const tabAt = (url: string, navigate: () => Promise<unknown>) => ({ url, navigate: vi.fn(navigate) });

describe("service worker", () => {
  it("takes control of the tab that registered it", async () => {
    const claim = vi.fn(() => Promise.resolve());
    const waitUntil = vi.fn();
    const handlers = loadWorker({ claim });
    expect(handlers.activate).toBeDefined();
    handlers.activate!({ waitUntil });
    expect(claim).toHaveBeenCalled();
    expect(waitUntil).toHaveBeenCalledWith(expect.any(Promise));
  });

  it("opens a window when the matched tab refuses to be navigated", async () => {
    // matchAll asks for uncontrolled tabs, and navigate() rejects on those:
    // "This service worker is not the client's active service worker."
    const tab = tabAt("https://sift.yasint.dev/", () => Promise.reject(new TypeError("not the active worker")));
    const openWindow = vi.fn(() => Promise.resolve({}));
    const handlers = loadWorker({ matchAll: () => Promise.resolve([tab]), openWindow });
    const event = clickEvent("/2026-07-04.html");
    handlers.notificationclick!(event);
    await expect(event.settled()).resolves.toBeDefined();
    expect(tab.navigate).toHaveBeenCalledWith("/2026-07-04.html");
    expect(openWindow).toHaveBeenCalledWith("/2026-07-04.html");
  });

  it("navigates and focuses a tab it can drive, without opening a second one", async () => {
    const focus = vi.fn();
    const tab = tabAt("https://sift.yasint.dev/2026-07-03.html", () => Promise.resolve({ focus }));
    const openWindow = vi.fn(() => Promise.resolve({}));
    const handlers = loadWorker({ matchAll: () => Promise.resolve([tab]), openWindow });
    const event = clickEvent("/2026-07-04.html");
    handlers.notificationclick!(event);
    await event.settled();
    expect(tab.navigate).toHaveBeenCalledWith("/2026-07-04.html");
    expect(focus).toHaveBeenCalled();
    expect(openWindow).not.toHaveBeenCalled();
  });

  it("opens a window when no tab of the site is left open", async () => {
    const openWindow = vi.fn(() => Promise.resolve({}));
    const handlers = loadWorker({
      matchAll: () => Promise.resolve([{ url: "https://yasint.dev/", navigate: vi.fn() }]),
      openWindow,
    });
    const event = clickEvent();
    handlers.notificationclick!(event);
    await event.settled();
    expect(openWindow).toHaveBeenCalledWith("/");
  });
});
