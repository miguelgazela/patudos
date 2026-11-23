"use client";

import { FieldError } from "@/components/auth/banner";
import { TRIBUTE_TEXT_MAX } from "@/lib/pets/tribute";

/** Caixa de texto do tributo («Umas palavras»). */
export function TributeTextField({
  defaultValue = "",
  error,
}: {
  defaultValue?: string;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="tribute_text" className="text-etiqueta">
        Umas palavras (opcional)
      </label>
      <textarea
        id="tribute_text"
        name="tribute_text"
        rows={5}
        maxLength={TRIBUTE_TEXT_MAX}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby="tribute_text-ajuda"
        className="focus:shadow-foco w-full rounded-campo border-2 border-linha bg-branco px-4 py-3 text-corpo font-semibold outline-none focus:border-pinheiro aria-invalid:border-atraso"
      />
      {error ? <FieldError id="tribute_text-erro">{error}</FieldError> : null}
      <p id="tribute_text-ajuda" className="text-legenda text-tinta-suave">
        Como era, o que lhe dava alegria, o que fica contigo.
      </p>
    </div>
  );
}
