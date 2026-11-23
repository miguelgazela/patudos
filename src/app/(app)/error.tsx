"use client";

import { ErrorView } from "@/components/nav/error-view";

// Erro dentro da área autenticada: o conteúdo é substituído, a barra inferior mantém-se.
export default function AppError({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return <ErrorView reset={reset} />;
}
