"use client";

import { CalendarCheck, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { ConfirmDialog } from "@/components/consulta/ui";
import { Button } from "@/components/ui/button";
import { deleteRecord, endMedication } from "@/lib/ficha/actions";
import type { RecordKind } from "@/lib/ficha/data";

/** «Apagar» com confirmação; volta à cronologia do animal. */
export function DeleteRecordButton({
  kind,
  id,
  petId,
  label,
}: {
  kind: RecordKind;
  id: string;
  petId: string;
  label: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function remove() {
    startTransition(async () => {
      const res = await deleteRecord(kind, id);
      if (!res.ok) {
        setOpen(false);
        setMessage(res.message);
        return;
      }
      router.push(`/animais/${petId}/cronologia`);
    });
  }

  return (
    <>
      <Button type="button" variant="destructive" onClick={() => setOpen(true)}>
        <Trash2 aria-hidden strokeWidth={2.2} />
        Apagar
      </Button>
      {message ? (
        <p role="alert" className="text-center text-etiqueta text-atraso">
          {message}
        </p>
      ) : null}
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Apagar ${label}?`}
        confirmLabel="Apagar"
        cancelLabel="Cancelar"
        pending={pending}
        onConfirm={remove}
      >
        Esta ação não se pode desfazer.
      </ConfirmDialog>
    </>
  );
}

/** «Terminar medicação»: a última toma passa a ser hoje. */
export function EndMedicationButton({ id }: { id: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function end() {
    startTransition(async () => {
      const res = await endMedication(id);
      setOpen(false);
      if (!res.ok) {
        setMessage(res.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        <CalendarCheck aria-hidden strokeWidth={2.2} />
        Terminar medicação
      </Button>
      {message ? (
        <p role="alert" className="text-center text-etiqueta text-atraso">
          {message}
        </p>
      ) : null}
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Terminar a medicação?"
        confirmLabel="Terminar"
        cancelLabel="Cancelar"
        pending={pending}
        destructive={false}
        onConfirm={end}
      >
        A data de fim passa a ser hoje. A medicação deixa de aparecer como
        ativa.
      </ConfirmDialog>
    </>
  );
}
