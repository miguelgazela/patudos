"use client";

import { useState } from "react";

import { FeitoSheet, type FeitoPet } from "@/components/hoje/feito-sheet";
import type { TreatmentInfo } from "@/lib/lembretes/data";

/** «Feito» numa data prevista da ficha: abre a mesma confirmação do ecrã Hoje. */
export function DueFeito({
  occurrenceId,
  pet,
  info,
  today,
}: {
  occurrenceId: string;
  pet: FeitoPet;
  info: TreatmentInfo;
  today: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Marcar ${info.title} como feito`}
        className="focus-visible:shadow-foco mr-3 h-chip shrink-0 rounded-capsula bg-feito-fundo px-5 text-etiqueta font-extrabold text-feito-texto outline-none active:translate-y-px"
      >
        Feito
      </button>
      {open ? (
        <FeitoSheet
          open
          onOpenChange={setOpen}
          occurrenceId={occurrenceId}
          pet={pet}
          info={info}
          today={today}
        />
      ) : null}
    </>
  );
}
