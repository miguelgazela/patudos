"use client";

import { Ellipsis, Pencil, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

import { ConfirmDialog, Sheet } from "@/components/consulta/ui";
import { Button } from "@/components/ui/button";
import { shortDate } from "@/lib/pets/age";
import { deleteMemory } from "@/lib/pets/tribute-actions";
import type { Memory } from "@/lib/pets/tribute-data";

import { MemorySheet } from "./memory-sheet";

const rowClass =
  "flex min-h-14 w-full items-center gap-3 rounded-campo px-3 text-left text-corpo font-bold focus-visible:shadow-foco outline-none active:bg-linha-suave";

function MemoryCard({
  memory,
  petId,
  name,
}: {
  memory: Memory;
  petId: string;
  name: string;
}) {
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  return (
    <li className="flex flex-col gap-3 rounded-cartao border-[1.5px] border-linha bg-branco p-4">
      {memory.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={memory.photoUrl}
          alt=""
          className="max-h-72 w-full rounded-campo object-cover"
        />
      ) : null}
      <p className="text-corpo [overflow-wrap:anywhere] whitespace-pre-wrap">
        {memory.body}
      </p>
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 text-legenda text-tinta-suave">
          <span className="font-bold text-tinta">
            {memory.mine ? "Tu" : memory.author}
          </span>
          {" · "}
          {shortDate(memory.createdAt)}
        </p>
        {memory.canDelete ? (
          <button
            type="button"
            aria-label="Opções da memória"
            onClick={() => setMenu(true)}
            className="focus-visible:shadow-foco flex size-11 shrink-0 items-center justify-center rounded-full bg-linha-suave text-tinta outline-none active:translate-y-px"
          >
            <Ellipsis className="size-6" strokeWidth={2.2} aria-hidden />
          </button>
        ) : null}
      </div>
      {failed ? (
        <p role="alert" className="text-etiqueta text-atraso">
          Não conseguimos apagar. Tenta de novo.
        </p>
      ) : null}

      <Sheet open={menu} onOpenChange={setMenu} title="Memória">
        <ul className="flex flex-col">
          {memory.mine ? (
            <li>
              <button
                type="button"
                className={rowClass}
                onClick={() => {
                  setMenu(false);
                  setEditing(true);
                }}
              >
                <Pencil
                  className="size-6 text-pinheiro"
                  strokeWidth={2.2}
                  aria-hidden
                />
                Editar
              </button>
            </li>
          ) : null}
          <li>
            <button
              type="button"
              className={`${rowClass} text-atraso active:bg-atraso-fundo`}
              onClick={() => {
                setMenu(false);
                setConfirm(true);
              }}
            >
              <Trash2 className="size-6" strokeWidth={2.2} aria-hidden />
              Apagar
            </button>
          </li>
        </ul>
      </Sheet>

      <MemorySheet
        open={editing}
        onOpenChange={setEditing}
        petId={petId}
        name={name}
        edit={{ id: memory.id, body: memory.body, photoUrl: memory.photoUrl }}
      />

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Apagar esta memória?"
        confirmLabel="Apagar"
        cancelLabel="Cancelar"
        pending={pending}
        onConfirm={() =>
          startTransition(async () => {
            const res = await deleteMemory(memory.id).catch(() => ({
              ok: false,
            }));
            setConfirm(false);
            setFailed(!res.ok);
          })
        }
      >
        {memory.mine
          ? "Deixa de aparecer no tributo."
          : `É a memória de ${memory.author}. Deixa de aparecer no tributo.`}
      </ConfirmDialog>
    </li>
  );
}

/** Memórias de quem cuidou do animal, com «Deixar uma memória». */
export function Memories({
  petId,
  name,
  memories,
}: {
  petId: string;
  name: string;
  memories: Memory[];
}) {
  const [adding, setAdding] = useState(false);
  return (
    <section className="flex flex-col gap-3" aria-labelledby="memorias">
      <h2 id="memorias" className="text-seccao">
        Memórias
      </h2>
      {memories.length ? (
        <ul className="flex flex-col gap-3">
          {memories.map((m) => (
            <MemoryCard key={m.id} memory={m} petId={petId} name={name} />
          ))}
        </ul>
      ) : (
        <p className="rounded-cartao border-[1.5px] border-dashed border-linha px-4 py-5 text-corpo text-tinta-suave">
          Ainda ninguém deixou uma memória. Podes ser tu a primeira.
        </p>
      )}
      <Button type="button" variant="secondary" onClick={() => setAdding(true)}>
        <Plus aria-hidden strokeWidth={2.8} />
        Deixar uma memória
      </Button>
      <MemorySheet
        open={adding}
        onOpenChange={setAdding}
        petId={petId}
        name={name}
      />
    </section>
  );
}
