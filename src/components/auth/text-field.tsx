import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

import { FieldError } from "./banner";

/** Campo com etiqueta sempre visível e erro por baixo. */
export function TextField({
  label,
  help,
  error,
  id,
  className,
  ...props
}: Omit<ComponentProps<"input">, "id"> & {
  id: string;
  label: string;
  help?: ReactNode;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-etiqueta text-tinta">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          error ? `${id}-erro` : help ? `${id}-ajuda` : undefined
        }
        className={cn(
          "focus:shadow-foco h-campo w-full rounded-campo border-2 border-linha bg-branco px-4 text-corpo font-semibold text-tinta outline-none placeholder:text-placeholder focus:border-pinheiro aria-invalid:border-atraso aria-invalid:bg-atraso-campo",
          className,
        )}
        {...props}
      />
      {error ? (
        <FieldError id={`${id}-erro`}>{error}</FieldError>
      ) : help ? (
        <p id={`${id}-ajuda`} className="text-legenda text-tinta-suave">
          {help}
        </p>
      ) : null}
    </div>
  );
}
