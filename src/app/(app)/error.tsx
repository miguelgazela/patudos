"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

import { ErrorView } from "@/components/nav/error-view";

// Erro dentro da área autenticada: o conteúdo é substituído, a barra inferior mantém-se.
export default function AppError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return <ErrorView reset={reset} />;
}
