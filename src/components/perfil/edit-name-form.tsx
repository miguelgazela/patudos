"use client";

import { Check } from "lucide-react";
import { useActionState, useState } from "react";

import { TextField } from "@/components/auth/text-field";
import { Button } from "@/components/ui/button";
import { showToast } from "@/components/ui/toast";
import { updateName, type UpdateNameState } from "@/lib/auth/actions";

/** Cartão com nome e email; «Editar nome» abre o campo ali mesmo. */
export function EditNameForm({ name, email }: { name: string; email: string }) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState<UpdateNameState, FormData>(
    async (prev, formData) => {
      const next = await updateName(prev, formData);
      if (next.saved) {
        setEditing(false);
        showToast("Nome guardado");
      }
      return next;
    },
    {},
  );
  const shown = state.saved ? (state.name ?? name) : name;

  return (
    <section
      aria-label="A tua conta"
      className="flex flex-col gap-4 rounded-cartao border-[1.5px] border-linha bg-branco p-4"
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex size-14 shrink-0 items-center justify-center rounded-full bg-pinheiro text-[22px] font-extrabold text-branco"
        >
          {shown.trim().charAt(0).toUpperCase() || "?"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[19px] font-extrabold">{shown}</p>
          <dl>
            <dt className="sr-only">O teu email</dt>
            <dd className="text-legenda break-all text-tinta-suave">{email}</dd>
          </dl>
        </div>
        {!editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="focus-visible:shadow-foco h-11 shrink-0 rounded-capsula bg-menta px-4 text-etiqueta font-extrabold text-pinheiro-escuro outline-none"
          >
            Editar nome
          </button>
        ) : null}
      </div>

      {editing ? (
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
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="focus-visible:shadow-foco h-12 rounded-capsula text-corpo font-extrabold text-pinheiro underline underline-offset-4 outline-none"
          >
            Cancelar
          </button>
        </form>
      ) : state.saved ? (
        <p
          role="status"
          className="flex items-center gap-2 text-etiqueta text-feito-texto"
        >
          <Check className="size-5" strokeWidth={2.8} aria-hidden />
          Nome guardado
        </p>
      ) : null}
    </section>
  );
}
