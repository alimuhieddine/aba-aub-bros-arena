self.addEventListener("push", event => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch (error) {
    payload = {
      title: "ABA",
      body: event.data ? event.data.text() : "New ABA notification"
    };
  }

  const title = payload.title || "ABA";
  const options = {
    body: payload.body || "New ABA notification",
    data: {
      url: payload.url || "./index.html",
      ...payload.data
    }
  };

  if (payload.icon) options.icon = payload.icon;
  if (payload.badge) options.badge = payload.badge;

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "./index.html";

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
