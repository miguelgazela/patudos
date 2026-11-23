"use client";

import { Undo2 } from "lucide-react";
import { useState, useTransition } from "react";

import { ConfirmDialog } from "@/components/consulta/ui";
import { Button } from "@/components/ui/button";
import { undoDeceased } from "@/lib/pets/tribute-actions";

/** «Afinal não faleceu»: desfaz o tributo se foi marcado sem querer (só o dono). */
export function UndoDeceased({ petId, name }: { petId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <>
      <Button type="button" variant="link" onClick={() => setOpen(true)}>
        <Undo2 aria-hidden strokeWidth={2.2} className="size-5" />
        Afinal não faleceu
      </Button>
      {failed ? (
        <p role="alert" className="text-center text-etiqueta text-atraso">
          Não conseguimos desfazer. Tenta de novo.
        </p>
      ) : null}
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`${name} afinal não faleceu?`}
        confirmLabel="Sim, desfazer"
        cancelLabel="Cancelar"
        destructive={false}
        pending={pending}
        onConfirm={() =>
          startTransition(async () => {
            try {
              const res = await undoDeceased(petId);
              if (res && !res.ok) setFailed(true);
            } catch {
              setFailed(true);
            }
            setOpen(false);
          })
        }
      >
        O tributo deixa de aparecer e {name} volta à lista de animais. As
        memórias que as pessoas deixaram são apagadas.
      </ConfirmDialog>
    </>
  );
}
