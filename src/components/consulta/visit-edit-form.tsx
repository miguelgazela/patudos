"use client";

import { Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { ErrorBanner } from "@/components/auth/banner";
import { TextField } from "@/components/auth/text-field";
import { Button } from "@/components/ui/button";
import { deleteVetVisit, updateVetVisit } from "@/lib/vet-visits/actions";

import { ConfirmDialog, ReasonField, VetField } from "./ui";

/** Ecrã 13 (editar): os campos da consulta e «Apagar consulta». */
export function VisitEditForm({
  visitId,
  petId,
  petName,
  today,
  initial,
  vets,
  registeredBy,
}: {
  visitId: string;
  petId: string;
  petName: string;
  today: string;
  initial: {
    visited_on: string;
    reason: string;
    vet_name: string;
    notes: string;
  };
  vets: string[];
  registeredBy: string;
}) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const back = `/animais/${petId}`;

  function save() {
    startTransition(async () => {
      const res = await updateVetVisit(visitId, v);
      if (!res.ok) {
        setErrors(res.errors ?? {});
        setMessage(res.message);
        return;
      }
      router.push(back);
    });
  }

  function remove() {
    startTransition(async () => {
      const res = await deleteVetVisit(visitId);
      if (!res.ok) {
        setConfirmOpen(false);
        setMessage(res.message);
        return;
      }
      router.push(back);
    });
  }

  return (
    <>
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Fechar"
          className="focus-visible:shadow-foco flex size-11 items-center justify-center rounded-full bg-linha-suave text-tinta outline-none"
        >
          <X className="size-6" strokeWidth={2.2} aria-hidden />
        </button>
        <h1 className="text-[22px] font-extrabold tracking-tight">
          Consulta de {petName}
        </h1>
      </header>

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className="flex flex-col gap-5"
      >
        {message ? <ErrorBanner>{message}</ErrorBanner> : null}
        <p className="text-legenda text-tinta-suave">{registeredBy}</p>

        <TextField
          id="visited_on"
          type="date"
          label="Data"
          max={today}
          value={v.visited_on}
          onChange={(e) => setV({ ...v, visited_on: e.target.value })}
          error={errors.visited_on}
        />
        <ReasonField
          value={v.reason}
          onChange={(reason) => setV({ ...v, reason })}
          error={errors.reason}
        />
        <VetField
          value={v.vet_name}
          onChange={(vet_name) => setV({ ...v, vet_name })}
          suggestions={vets}
        />
        <div className="flex flex-col gap-2">
          <label htmlFor="notes" className="text-etiqueta">
            Notas
          </label>
          <textarea
            id="notes"
            rows={3}
            maxLength={2000}
            value={v.notes}
            onChange={(e) => setV({ ...v, notes: e.target.value })}
            className="focus:shadow-foco w-full rounded-campo border-2 border-linha bg-branco px-4 py-3 text-corpo font-semibold outline-none focus:border-pinheiro"
          />
        </div>

        <p className="text-legenda text-tinta-suave">
          Vacinas, medicação, peso e custo desta consulta já estão guardados e
          não se alteram aqui.
        </p>

        <Button type="submit" disabled={pending}>
          {pending ? "A guardar…" : "Guardar"}
        </Button>
        <Button
          type="button"
          variant="destructive"
          onClick={() => setConfirmOpen(true)}
          disabled={pending}
        >
          <Trash2 aria-hidden strokeWidth={2.2} />
          Apagar consulta
        </Button>
      </form>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Apagar a consulta de ${petName}?`}
        confirmLabel="Apagar consulta"
        cancelLabel="Cancelar"
        pending={pending}
        onConfirm={remove}
      >
        As vacinas, a medicação, o peso, a despesa e os anexos desta consulta
        ficam guardados, mas deixam de estar ligados a ela.
      </ConfirmDialog>
    </>
  );
}
