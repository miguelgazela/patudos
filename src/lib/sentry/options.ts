import type { BrowserOptions } from "@sentry/nextjs";

import { scrubEvent } from "./scrub";

/** Opções comuns (cliente e servidor): sem dados pessoais (`dataCollection` tudo a falso), sem traços, sem replays, sem breadcrumbs. */
export function sentryOptions(dsn: string | undefined): BrowserOptions {
  return {
    dsn,
    enabled: !!dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    // v11: o SDK recolhe por defeito cookies, cabeçalhos, corpos e query strings. Tudo desligado.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: { request: false, response: false },
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
    },
    tracesSampleRate: 0,
    beforeBreadcrumb: () => null,
    beforeSend: (event) => scrubEvent(event),
  };
}
