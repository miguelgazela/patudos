"use client";

import { useActionState, useState } from "react";

import { ErrorBanner, FieldError } from "@/components/auth/banner";
import { Sheet } from "@/components/consulta/ui";
import { PartialDateField } from "@/components/tributo/partial-date-field";
import { failMessage } from "@/lib/client-action";
import { lisbonToday } from "@/lib/pets/age";
import { archivePet, type TributeState } from "@/lib/pets/tribute-actions";
import { cn } from "@/lib/utils";

const REASONS = [
  {
    value: "deceased",
    title: "Faleceu",
    help: "Fica com uma página em sua memória.",
  },
  {
    value: "other",
    title: "Já não está comigo",
    help: "Fica guardado, só para consulta.",
  },
] as const;

/** Arquivar com motivo: «Faleceu» (pede a data, que pode ser aproximada) ou «Já não está comigo». */
export function ArchiveSheet({
  open,
  onOpenChange,
  petId,
  name,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  petId: string;
  name: string;
}) {
  const [reason, setReason] = useState<"deceased" | "other" | null>(null);
  const [state, action, pending] = useActionState<TributeState, FormData>(
    async (prev, formData) => {
      try {
        return await archivePet(petId, prev, formData);
      } catch {
        return { ...prev, message: failMessage() };
      }
    },
    {},
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={`Arquivar ${name}`}>
      <form action={action} noValidate className="flex flex-col gap-5">
        {state.message ? <ErrorBanner>{state.message}</ErrorBanner> : null}
        {/* Campo escondido: o React repõe o formulário depois de um erro e os botões de rádio perdiam a escolha. */}
        <input type="hidden" name="reason" value={reason ?? ""} />
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 text-etiqueta">Porque vais arquivar?</legend>
          {REASONS.map((r) => (
            <label key={r.value} className="cursor-pointer">
              <input
                type="radio"
                value={r.value}
                checked={reason === r.value}
                onChange={() => setReason(r.value)}
                className="peer sr-only"
              />
              <span className="peer-focus-visible:shadow-foco flex min-h-16 flex-col justify-center rounded-cartao border-2 border-linha bg-branco px-4 py-3 peer-checked:border-pinheiro peer-checked:bg-menta">
                <span className="text-corpo font-extrabold">{r.title}</span>
                <span className="text-legenda text-tinta-suave">{r.help}</span>
              </span>
            </label>
          ))}
          {state.errors?.reason ? (
            <FieldError id="reason-erro">{state.errors.reason}</FieldError>
          ) : null}
        </fieldset>

        {reason === "deceased" ? (
          <PartialDateField
            name="deceased_on"
            legend="Quando faleceu"
            defaultValue={lisbonToday()}
            error={state.errors?.deceased_on}
            help="Se não souberes o dia, escolhe Mês ou Ano."
          />
        ) : null}

        {reason === "other" ? (
          <p className="text-corpo text-tinta-suave">
            Deixa de aparecer na lista, mas o historial fica guardado. Podes
            reativar quando quiseres.
          </p>
        ) : null}

        <button
          type="submit"
          disabled={!reason || pending}
          className={cn(
            "focus-visible:shadow-foco h-botao w-full rounded-capsula text-corpo font-extrabold outline-none disabled:bg-desativado disabled:text-desativado-texto",
            reason === "deceased"
              ? "bg-pinheiro text-branco"
              : "bg-atraso text-branco",
          )}
        >
          {pending
            ? "A guardar…"
            : reason === "deceased"
              ? "Guardar"
              : "Arquivar"}
        </button>
      </form>
    </Sheet>
  );
}
