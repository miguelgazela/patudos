import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";

/** Aviso de erro (variante «atraso» do design). */
export function ErrorBanner({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-[20px] bg-atraso-fundo p-4 text-etiqueta text-atraso-banner"
    >
      <p className="flex items-start gap-3">
        <CircleAlert
          className="mt-0.5 size-5 shrink-0"
          strokeWidth={2.2}
          aria-hidden
        />
        <span>{children}</span>
      </p>
      {action}
    </div>
  );
}

export function FieldError({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) {
  return (
    <p id={id} className="flex items-start gap-2 text-etiqueta text-atraso">
      <CircleAlert
        className="mt-0.5 size-[18px] shrink-0"
        strokeWidth={2.2}
        aria-hidden
      />
      <span>{children}</span>
    </p>
  );
}
