/* Service worker ECO-VISA — SOLO notifiche Push.
 * A differenza di BioFido, ECO-VISA resta un sito "online": qui NON si fa cache
 * offline né app-shell. Questo SW serve unicamente a ricevere le notifiche push
 * (prenotazioni, messaggi, "Contatta l'azienda"). Viene registrato solo quando
 * l'utente attiva le notifiche dalla dashboard. */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "ECO-VISA", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "ECO-VISA";
  const options = {
    body: data.body || "",
    icon: data.icon || "/brand/icon-192.png",
    badge: data.icon || "/brand/icon-192.png",
    data: { url: data.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((wins) => {
      for (const w of wins) {
        if (w.url === url && "focus" in w) return w.focus();
      }
      return clients.openWindow(url);
    }),
  );
});
