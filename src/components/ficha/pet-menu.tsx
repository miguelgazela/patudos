"use client";

import {
  Archive,
  Bell,
  Ellipsis,
  FileText,
  Flower2,
  Pencil,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Sheet } from "@/components/consulta/ui";
import { ArchiveSheet } from "@/components/pets/archive-sheet";

const rowClass =
  "flex min-h-14 w-full items-center gap-3 rounded-campo px-3 text-left text-corpo font-bold";

/**
 * Menu «⋯» da ficha. O dono edita, gere pessoas e arquiva; o cuidador só vê
 * «Pessoas» (leitura). «Lembretes» abre o ecrã 22.
 */
export function PetMenu({
  petId,
  name,
  isOwner,
  archived,
  deceased,
}: {
  petId: string;
  name: string;
  isOwner: boolean;
  archived: boolean;
  deceased: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);

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
          {deceased ? (
            <li>
              <Link
                href={`/animais/${petId}/tributo`}
                onClick={() => setOpen(false)}
                className={`${rowClass} focus-visible:shadow-foco outline-none active:bg-linha-suave`}
              >
                <Flower2
                  className="size-6 text-pinheiro"
                  strokeWidth={2.2}
                  aria-hidden
                />
                Ver tributo
              </Link>
            </li>
          ) : null}
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
          <li>
            <Link
              href={`/animais/${petId}/lembretes`}
              onClick={() => setOpen(false)}
              className={`${rowClass} focus-visible:shadow-foco outline-none active:bg-linha-suave`}
            >
              <Bell
                className="size-6 text-pinheiro"
                strokeWidth={2.2}
                aria-hidden
              />
              Lembretes
            </Link>
          </li>
          <li>
            <Link
              href={`/animais/${petId}/pdf`}
              onClick={() => setOpen(false)}
              className={`${rowClass} focus-visible:shadow-foco outline-none active:bg-linha-suave`}
            >
              <FileText
                className="size-6 text-pinheiro"
                strokeWidth={2.2}
                aria-hidden
              />
              Ficha em PDF
            </Link>
          </li>
          {isOwner && !archived ? (
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

      <ArchiveSheet
        open={confirm}
        onOpenChange={setConfirm}
        petId={petId}
        name={name}
      />
    </>
  );
}
