/* Service worker mínimo dos Patudos.
 *
 * Serve só para a app poder ser instalada e, mais tarde, receber push.
 * Regra do produto: SEM modo offline e SEM cache de dados. Por isso não
 * há `fetch` handler nem `caches`: todos os pedidos vão sempre à rede.
 */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Fase 3 (notificações): tratar aqui os eventos `push` e `notificationclick`.
// self.addEventListener("push", (event) => { ... });
// self.addEventListener("notificationclick", (event) => { ... });
