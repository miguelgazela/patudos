"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { requestCode, type RequestCodeState } from "@/lib/auth/actions";

import { ErrorBanner } from "./banner";
import { TextField } from "./text-field";

const initial: RequestCodeState = {};

export function EmailForm({ defaultEmail }: { defaultEmail?: string }) {
  const [state, action, pending] = useActionState(requestCode, initial);

  return (
    <form action={action} noValidate className="flex flex-col gap-6">
      {state.error === "send" && (
        <ErrorBanner
          action={
            <Button
              type="submit"
              variant="destructive"
              size="auto"
              disabled={pending}
            >
              Tentar de novo
            </Button>
          }
        >
          {state.message}
        </ErrorBanner>
      )}
      <TextField
        id="email"
        name="email"
        label="O teu email"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        autoCorrect="off"
        placeholder="ana@exemplo.pt"
        defaultValue={state.email ?? defaultEmail}
        key={state.email}
        error={state.error === "invalid" ? state.message : undefined}
        required
      />
      <Button type="submit" disabled={pending}>
        {pending ? "A enviar…" : "Enviar código"}
      </Button>
    </form>
  );
}
