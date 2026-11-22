"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { saveName, type SaveNameState } from "@/lib/auth/actions";

import { TextField } from "./text-field";

const initial: SaveNameState = {};

export function NameForm() {
  const [state, action, pending] = useActionState(saveName, initial);

  return (
    <form action={action} noValidate className="flex flex-col gap-6">
      <TextField
        id="name"
        name="name"
        label="O teu nome"
        autoComplete="given-name"
        autoCapitalize="words"
        placeholder="Pedro"
        help="Aparece aos outros como «registado por…»."
        defaultValue={state.name}
        key={state.name}
        error={state.message}
        required
        autoFocus
      />
      <Button type="submit" disabled={pending}>
        {pending ? "A guardar…" : "Continuar"}
      </Button>
    </form>
  );
}
