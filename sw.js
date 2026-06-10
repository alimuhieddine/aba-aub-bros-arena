self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("./index.html")));
    return;
  }

  event.respondWith(caches.match(request).then(cached => cached || fetch(request)));
});

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open("aba-pwa-shell-v1");
    await Promise.all([
      "./index.html",
      "./manifest.json",
      "./assets/icons/icon-192.png",
      "./assets/icons/icon-512.png",
      "./assets/icons/maskable-192.png",
      "./assets/icons/maskable-512.png"
    ].map(url => cache.add(url).catch(error => {
      console.warn("ABA cache add skipped:", url, error);
    })));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", event => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch (error) {
    payload = {
      title: "Notification",
      body: event.data ? event.data.text() : "New notification"
    };
  }

  const title = payload.title || "Notification";
  const resolveTargetUrl = rawUrl => {
    const fallback = "./index.html";
    const scope = self.registration?.scope || self.location?.href || fallback;

    try {
      return new URL(rawUrl || fallback, scope).href;
    } catch {
      try {
        return new URL(fallback, scope).href;
      } catch {
        return fallback;
      }
    }
  };

  const options = {
    body: payload.body || "New notification",
    tag: payload.tag || undefined,
    renotify: Boolean(payload.renotify),
    requireInteraction: Boolean(payload.requireInteraction),
    timestamp: Number(payload.timestamp || Date.now()),
    data: {
      url: resolveTargetUrl(payload.url),
      ...payload.data
    }
  };

  if (payload.icon) options.icon = payload.icon;
  if (payload.badge) options.badge = payload.badge;

  event.waitUntil((async () => {
    const windows = await clients.matchAll({
      type: "window",
      includeUncontrolled: true
    });

    windows.forEach(client => {
      client.postMessage({
        type: "aba_push_received",
        notificationType: payload.data?.type || "unknown",
        title,
        body: options.body
      });
    });

    await self.registration.showNotification(title, options);
  })());
});

self.addEventListener("notificationclick", event => {
  event.notification.close();

  const rawTargetUrl = event.notification.data?.url || "./index.html";
  const targetUrl = (() => {
    try {
      return new URL(rawTargetUrl, self.registration?.scope || self.location?.href || "./index.html").href;
    } catch {
      return rawTargetUrl || "./index.html";
    }
  })();

  event.waitUntil((async () => {
    const windows = await clients.matchAll({
      type: "window",
      includeUncontrolled: true
    });

    for (const client of windows) {
      if ("focus" in client) {
        await client.focus();
        if ("navigate" in client) await client.navigate(targetUrl);
        return;
      }
    }

    if (clients.openWindow) {
      await clients.openWindow(targetUrl);
    }
  })());
});
