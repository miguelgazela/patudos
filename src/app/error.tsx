"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

import { ErrorView } from "@/components/nav/error-view";

// Erro fora da área autenticada (entrar, bem-vindo…).
export default function RootError({
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
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pt-[max(env(safe-area-inset-top),32px)] pb-[max(env(safe-area-inset-bottom),32px)]">
      <ErrorView reset={reset} />
    </main>
  );
}
