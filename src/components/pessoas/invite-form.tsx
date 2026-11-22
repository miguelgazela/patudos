"use client";

import { Send } from "lucide-react";
import { useActionState, useState } from "react";

import { ErrorBanner } from "@/components/auth/banner";
import { TextField } from "@/components/auth/text-field";
import { Button } from "@/components/ui/button";
import { invitePerson, type InviteState } from "@/lib/people/actions";
import { cn } from "@/lib/utils";

const initial: InviteState = {};

const roles = [
  { value: "caregiver", label: "Cuidador" },
  { value: "owner", label: "Dono" },
] as const;

/** Ecrã 21: email + papel + texto do que a pessoa vai poder fazer. */
export function InviteForm({
  petId,
  petName,
}: {
  petId: string;
  petName: string;
}) {
  const [state, action, pending] = useActionState(
    invitePerson.bind(null, petId),
    initial,
  );
  const [role, setRole] = useState<"caregiver" | "owner">("caregiver");

  return (
    <form action={action} noValidate className="flex flex-1 flex-col gap-5">
      {state.message && !state.emailError ? (
        <ErrorBanner>{state.message}</ErrorBanner>
      ) : null}
      <TextField
        id="email"
        name="email"
        label="Email"
        type="email"
        inputMode="email"
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        placeholder="mae@exemplo.pt"
        defaultValue={state.email}
        key={state.email}
        error={state.emailError ? state.message : undefined}
        required
      />

      <fieldset className="flex flex-col gap-2">
        <legend className="text-etiqueta">Papel</legend>
        <input type="hidden" name="role" value={role} />
        <div
          role="radiogroup"
          aria-label="Papel"
          className="grid grid-cols-2 gap-1 rounded-capsula bg-linha-suave p-1"
        >
          {roles.map((r) => (
            <button
              key={r.value}
              type="button"
              role="radio"
              aria-checked={role === r.value}
              onClick={() => setRole(r.value)}
              className={cn(
                "focus-visible:shadow-foco h-12 rounded-capsula text-corpo font-bold outline-none",
                role === r.value
                  ? "bg-pinheiro text-branco"
                  : "text-tinta-suave",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2 rounded-cartao bg-menta p-4 text-pinheiro-escuro">
        <p className="text-corpo font-semibold">
          {role === "owner"
            ? `Vai poder fazer tudo com ${petName}: editar a ficha, convidar e remover pessoas.`
            : `Vai poder ver o historial de ${petName}, registar consultas e despesas, e receber lembretes.`}
        </p>
        <p className="text-etiqueta">
          Recebe um email com um código para entrar. Não precisa de configurar
          nada.
        </p>
      </div>

      <Button type="submit" disabled={pending} className="mt-auto">
        <Send aria-hidden strokeWidth={2.2} />
        {pending ? "A enviar…" : "Enviar convite"}
      </Button>
    </form>
  );
}
