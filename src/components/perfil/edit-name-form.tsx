"use client";

import { Check } from "lucide-react";
import { useActionState } from "react";

import { TextField } from "@/components/auth/text-field";
import { Button } from "@/components/ui/button";
import { updateName, type UpdateNameState } from "@/lib/auth/actions";

export function EditNameForm({ name }: { name: string }) {
  const [state, action, pending] = useActionState<UpdateNameState, FormData>(
    updateName,
    {},
  );

  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <TextField
        id="name"
        name="name"
        label="O teu nome"
        autoComplete="given-name"
        autoCapitalize="words"
        defaultValue={state.name ?? name}
        key={state.name ?? name}
        error={state.message}
        required
      />
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "A guardar…" : "Guardar nome"}
      </Button>
      {state.saved ? (
        <p
          role="status"
          className="flex items-center gap-2 text-etiqueta text-feito-texto"
        >
          <Check className="size-5" strokeWidth={2.8} aria-hidden />
          Nome guardado
        </p>
      ) : null}
    </form>
  );
}
