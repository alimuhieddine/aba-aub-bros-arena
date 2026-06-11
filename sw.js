const SHELL_CACHE = "aba-pwa-shell-v2";
const IMAGE_CACHE = "aba-image-cache-v1";
const IMAGE_CACHE_LIMIT = 160;
const SHELL_ASSETS = [
  "./index.html",
  "./manifest.json",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/maskable-192.png",
  "./assets/icons/maskable-512.png"
];

function isHttpRequest(request) {
  return request.url.startsWith("http://") || request.url.startsWith("https://");
}

function isImageRequest(request) {
  if (request.destination === "image") return true;

  try {
    const url = new URL(request.url);
    return /\.(png|jpe?g|webp|gif|avif|svg)$/i.test(url.pathname);
  } catch {
    return false;
  }
}

function isCacheableResponse(response) {
  return response && (
    response.ok ||
    response.type === "opaque"
  );
}

async function trimCache(cacheName, limit) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();

  if (keys.length <= limit) return;

  await Promise.all(
    keys.slice(0, keys.length - limit).map(key => cache.delete(key))
  );
}

async function staleWhileRevalidateImage(request) {
  const cache = await caches.open(IMAGE_CACHE);
  const cached = await cache.match(request);

  const networkFetch = fetch(request).then(async response => {
    if (isCacheableResponse(response)) {
      await cache.put(request, response.clone());
      trimCache(IMAGE_CACHE, IMAGE_CACHE_LIMIT).catch(error => {
        console.warn("ABA image cache trim skipped:", error);
      });
    }

    return response;
  }).catch(error => {
    if (cached) return cached;
    throw error;
  });

  return cached || networkFetch;
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || !isHttpRequest(request)) return;

  const url = new URL(request.url);

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("./index.html")));
    return;
  }

  if (isImageRequest(request)) {
    event.respondWith(staleWhileRevalidateImage(request));
    return;
  }

  if (url.origin !== self.location.origin) return;

  event.respondWith(caches.match(request).then(cached => cached || fetch(request)));
});

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await Promise.all(SHELL_ASSETS.map(url => cache.add(url).catch(error => {
      console.warn("ABA cache add skipped:", url, error);
    })));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keepCaches = new Set([SHELL_CACHE, IMAGE_CACHE]);
    const cacheNames = await caches.keys();

    await Promise.all(
      cacheNames
        .filter(cacheName => cacheName.startsWith("aba-") && !keepCaches.has(cacheName))
        .map(cacheName => caches.delete(cacheName))
    );

    await self.clients.claim();
  })());
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
