import * as Sentry from "@sentry/nextjs";

import { sentryOptions } from "@/lib/sentry/options";

// Erros do browser → Sentry (sem PII, sem replays). Sem DSN fica desligado.
Sentry.init(sentryOptions(process.env.NEXT_PUBLIC_SENTRY_DSN));

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
