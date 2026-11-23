// Relatório de erros da Edge Function para o Sentry, sem SDK (só `fetch`), sem dados pessoais:
// tipo de erro, mensagem sem emails/ids, stack, função e ambiente. Sem `SENTRY_DSN` não faz nada.

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

export function scrub(text: string): string {
  return text.replace(EMAIL, "[email]").replace(UUID, ":id");
}

export function parseDsn(dsn: string): { key: string; url: string } | null {
  try {
    const u = new URL(dsn);
    const project = u.pathname.replace(/^\//, "");
    if (!u.username || !project) return null;
    return {
      key: u.username,
      url: `${u.protocol}//${u.host}/api/${project}/envelope/`,
    };
  } catch {
    return null;
  }
}

export function buildEnvelope(
  err: unknown,
  functionName: string,
  env: string,
  dsn: string,
  now = new Date(),
): string {
  const e = err instanceof Error ? err : new Error(String(err));
  const eventId = crypto.randomUUID().replaceAll("-", "");
  const event = {
    event_id: eventId,
    timestamp: now.getTime() / 1000,
    platform: "javascript",
    level: "error",
    environment: env,
    tags: { function: functionName, runtime: "supabase-edge" },
    exception: {
      values: [
        {
          type: e.name,
          value: scrub(e.message),
          stacktrace: undefined,
        },
      ],
    },
    // A stack vai como extra (texto), com ids/emails retirados.
    extra: { stack: scrub(e.stack ?? "") },
  };
  const header = { event_id: eventId, sent_at: now.toISOString(), dsn };
  return [
    JSON.stringify(header),
    JSON.stringify({ type: "event" }),
    JSON.stringify(event),
  ].join("\n");
}

export async function reportError(
  err: unknown,
  functionName: string,
  dsn: string | undefined,
  env = "production",
): Promise<void> {
  if (!dsn) return;
  const parsed = parseDsn(dsn);
  if (!parsed) return;
  try {
    await fetch(`${parsed.url}?sentry_key=${parsed.key}&sentry_version=7`, {
      method: "POST",
      headers: { "Content-Type": "application/x-sentry-envelope" },
      body: buildEnvelope(err, functionName, env, dsn),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Reportar nunca pode partir a função.
  }
}
