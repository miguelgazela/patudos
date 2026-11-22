"use client";

import { Archive, Bell, Ellipsis, Pencil, Users } from "lucide-react";
import Link from "next/link";
import { useState, useTransition, type ReactNode } from "react";

import { ConfirmDialog, Sheet } from "@/components/consulta/ui";
import { archivePet } from "@/lib/pets/actions";

const rowClass =
  "flex min-h-14 w-full items-center gap-3 rounded-campo px-3 text-left text-corpo font-bold";

function Disabled({ icon, children }: { icon: ReactNode; children: string }) {
  return (
    <li>
      <button
        type="button"
        disabled
        className={`${rowClass} text-desativado-texto`}
      >
        {icon}
        <span className="flex-1">{children}</span>
        <span className="rounded-capsula bg-desativado px-2.5 py-1 text-legenda">
          Em breve
        </span>
      </button>
    </li>
  );
}

/**
 * Menu «⋯» da ficha. O dono edita, gere pessoas e arquiva; o cuidador só vê
 * «Pessoas» (leitura). «Lembretes» aparece desativado até à Fase 3.
 */
export function PetMenu({
  petId,
  name,
  isOwner,
}: {
  petId: string;
  name: string;
  isOwner: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <button
        type="button"
        aria-label="Mais opções"
        onClick={() => setOpen(true)}
        className="focus-visible:shadow-foco flex size-11 items-center justify-center rounded-full bg-linha-suave text-tinta outline-none active:translate-y-px"
      >
        <Ellipsis className="size-6" strokeWidth={2.2} aria-hidden />
      </button>

      <Sheet open={open} onOpenChange={setOpen} title={name}>
        <ul className="flex flex-col">
          {isOwner ? (
            <li>
              <Link
                href={`/animais/${petId}/editar`}
                onClick={() => setOpen(false)}
                className={`${rowClass} focus-visible:shadow-foco outline-none active:bg-linha-suave`}
              >
                <Pencil
                  className="size-6 text-pinheiro"
                  strokeWidth={2.2}
                  aria-hidden
                />
                Editar ficha
              </Link>
            </li>
          ) : null}
          <li>
            <Link
              href={`/animais/${petId}/pessoas`}
              onClick={() => setOpen(false)}
              className={`${rowClass} focus-visible:shadow-foco outline-none active:bg-linha-suave`}
            >
              <Users
                className="size-6 text-pinheiro"
                strokeWidth={2.2}
                aria-hidden
              />
              Pessoas
            </Link>
          </li>
          <Disabled
            icon={<Bell className="size-6" strokeWidth={2.2} aria-hidden />}
          >
            Lembretes
          </Disabled>
          {isOwner ? (
            <li>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setConfirm(true);
                }}
                className={`${rowClass} focus-visible:shadow-foco text-atraso outline-none active:bg-atraso-fundo`}
              >
                <Archive className="size-6" strokeWidth={2.2} aria-hidden />
                Arquivar
              </button>
            </li>
          ) : null}
        </ul>
      </Sheet>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Arquivar ${name}?`}
        confirmLabel="Arquivar"
        cancelLabel="Cancelar"
        pending={pending}
        onConfirm={() => startTransition(() => archivePet(petId))}
      >
        Deixa de aparecer na lista, mas o historial fica guardado. Podes
        reativar quando quiseres.
      </ConfirmDialog>
    </>
  );
}
