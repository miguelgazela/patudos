"use client";

import { useActionState } from "react";

import { ErrorBanner } from "@/components/auth/banner";
import { Button } from "@/components/ui/button";
import { failMessage } from "@/lib/client-action";
import { updateTribute, type TributeState } from "@/lib/pets/tribute-actions";
import type { Precision } from "@/lib/pets/tribute";

import { PartialDateField } from "./partial-date-field";
import { TributeTextField } from "./tribute-fields";

/** Editar o tributo (dono): quando faleceu e as palavras do dono. */
export function TributeEditForm({
  petId,
  deceasedOn,
  precision,
  text,
}: {
  petId: string;
  deceasedOn: string;
  precision: Precision;
  text: string;
}) {
  const [state, action, pending] = useActionState<TributeState, FormData>(
    async (prev, formData) => {
      try {
        return await updateTribute(petId, prev, formData);
      } catch {
        return { ...prev, message: failMessage() };
      }
    },
    {},
  );
  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      {state.message ? <ErrorBanner>{state.message}</ErrorBanner> : null}
      <PartialDateField
        name="deceased_on"
        legend="Quando faleceu"
        defaultValue={deceasedOn}
        defaultPrecision={precision}
        error={state.errors?.deceased_on}
      />
      <TributeTextField
        defaultValue={text}
        error={state.errors?.tribute_text}
      />
      <Button type="submit" disabled={pending}>
        {pending ? "A guardar…" : "Guardar"}
      </Button>
    </form>
  );
}
