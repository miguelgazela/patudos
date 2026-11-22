/* Service worker dos Patudos.
 *
 * Serve só para a app poder ser instalada e para receber push.
 * Regra do produto: SEM modo offline e SEM cache de dados. Por isso não
 * há `fetch` handler nem `caches`: todos os pedidos vão sempre à rede.
 */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Push: { title, body, tag, url, occurrenceId } (ver supabase/functions/_shared/content.ts).
// Tem de mostrar sempre uma notificação (no iOS, push sem notificação revoga a subscrição).
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Patudos";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      // Uma notificação por ocorrência: um reenvio substitui em vez de empilhar.
      tag: data.tag || "patudos",
      data: { url: data.url || "/" },
      // Só os browsers que suportam ações as mostram; no iOS não existem.
      // O fluxo principal (tocar → confirmar na app) funciona sem elas.
      actions: data.occurrenceId
        ? [{ action: "feito", title: "Feito" }]
        : undefined,
    }),
  );
});

// Toque na notificação (ou na ação «Feito»): abre a app na ocorrência, onde se confirma.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  const target = new URL(url, self.location.origin).href;
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of all) {
        if (!client.url.startsWith(self.location.origin)) continue;
        try {
          await client.focus();
          if ("navigate" in client) {
            await client.navigate(target);
            return;
          }
        } catch {
          // cai para openWindow
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
