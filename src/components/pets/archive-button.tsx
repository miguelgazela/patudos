"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Archive } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { archivePet } from "@/lib/pets/actions";

/** «Arquivar» com confirmação (só para o dono). */
export function ArchiveButton({
  petId,
  name,
}: {
  petId: string;
  name: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger render={<Button type="button" variant="destructive" />}>
        <Archive aria-hidden strokeWidth={2.2} />
        Arquivar {name}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-[var(--scrim)] transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 flex w-[calc(100%-48px)] max-w-sm -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-dialogo bg-branco p-6 outline-none">
          <Dialog.Title className="text-seccao">Arquivar {name}?</Dialog.Title>
          <Dialog.Description className="text-corpo text-tinta-suave">
            Deixa de aparecer na lista, mas o historial fica guardado. Podes
            reativar quando quiseres.
          </Dialog.Description>
          <form
            action={archivePet.bind(null, petId)}
            className="flex flex-col gap-2"
          >
            <button
              type="submit"
              className="focus-visible:shadow-foco h-botao w-full rounded-capsula bg-atraso text-corpo font-extrabold text-branco outline-none"
            >
              Arquivar
            </button>
            <Button
              type="button"
              variant="link"
              className="w-full"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
