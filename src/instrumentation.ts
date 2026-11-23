import * as Sentry from "@sentry/nextjs";

import { sentryOptions } from "@/lib/sentry/options";

// Erros do servidor (Server Components, Server Actions, route handlers) → Sentry.
// Sem `SENTRY_DSN` não envia nada (desligado).
export function register() {
  Sentry.init(sentryOptions(process.env.SENTRY_DSN));
}

export const onRequestError = Sentry.captureRequestError;
