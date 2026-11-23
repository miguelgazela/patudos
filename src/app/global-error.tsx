"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

import "./globals.css";

import { ErrorView } from "@/components/nav/error-view";

// Último recurso: falha no próprio layout de raiz. Substitui a página inteira (por isso leva <html>/<body>).
export default function GlobalError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return (
    <html lang="pt-PT" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pt-[max(env(safe-area-inset-top),32px)] pb-[max(env(safe-area-inset-bottom),32px)]">
          <ErrorView reset={reset} />
        </main>
      </body>
    </html>
  );
}
