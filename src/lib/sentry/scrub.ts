// Limpeza dos eventos antes de saírem para o Sentry: nenhum dado pessoal.
// Só ficam o tipo de erro, a stack, a rota (sem ids), o ambiente e a versão.
import type { ErrorEvent } from "@sentry/nextjs";

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
// Segmentos longos de URL (tokens do feed .ics, ids): nunca devem sair.
const LONG_SEGMENT = /\/[A-Za-z0-9_-]{24,}(?:\.ics)?(?=\/|$)/g;

export function scrubText(text: string): string {
  return text.replace(EMAIL, "[email]").replace(UUID, ":id");
}

/** Caminho sem query, sem ids e sem tokens: `/animais/:id/pessoas`. */
export function scrubPath(url: string): string {
  let path = url;
  try {
    path = new URL(url, "http://x").pathname;
  } catch {
    path = url.split(/[?#]/)[0] ?? url;
  }
  return path.replace(UUID, ":id").replace(LONG_SEGMENT, "/:id");
}

export function scrubEvent<T extends ErrorEvent>(event: T): T {
  delete event.user;
  delete event.extra;
  delete event.server_name;
  delete event.breadcrumbs;
  delete event.contexts?.culture;
  if (event.request) {
    event.request = event.request.url
      ? { url: scrubPath(event.request.url), method: event.request.method }
      : {};
  }
  if (event.transaction) event.transaction = scrubPath(event.transaction);
  if (event.message) event.message = scrubText(event.message);
  for (const ex of event.exception?.values ?? []) {
    if (ex.value) ex.value = scrubText(ex.value);
    // Variáveis locais das frames podem ter dados: fora.
    for (const f of ex.stacktrace?.frames ?? []) delete f.vars;
  }
  if (event.tags) {
    for (const [k, v] of Object.entries(event.tags)) {
      if (typeof v === "string") event.tags[k] = scrubText(v);
    }
  }
  return event;
}
