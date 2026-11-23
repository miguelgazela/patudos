"use client";

import { Archive } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import { ArchiveSheet } from "./archive-sheet";

/** «Arquivar» (só para o dono): pergunta o motivo. */
export function ArchiveButton({
  petId,
  name,
}: {
  petId: string;
  name: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="destructive" onClick={() => setOpen(true)}>
        <Archive aria-hidden strokeWidth={2.2} />
        Arquivar {name}
      </Button>
      <ArchiveSheet
        open={open}
        onOpenChange={setOpen}
        petId={petId}
        name={name}
      />
    </>
  );
}
