"use client";

import { DELETED_ACCOUNT } from "@/lib/conta/labels";
import { safely } from "@/lib/client-action";
import { Check } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { PetAvatar } from "@/components/pets/pet-avatar";
import { completeOccurrence, undoOccurrence } from "@/lib/lembretes/actions";
import type { TreatmentInfo } from "@/lib/lembretes/data";
import {
  agoLabel,
  whenLabel,
  type HojeEntry,
  type HojeGroups,
} from "@/lib/lembretes/hoje";
import { colorStyles } from "@/lib/pets/constants";
import type { PetCard } from "@/lib/pets/data";
import { cn } from "@/lib/utils";

import { Sheet } from "@/components/consulta/ui";
import { Button } from "@/components/ui/button";

import { FeitoSheet } from "./feito-sheet";

type Ctx = {
  pets: Record<string, PetCard>;
  treatments: Record<string, TreatmentInfo>;
  today: string;
  /** Instante do servidor: os «há 5 min» não variam entre servidor e cliente. */
  nowMs: number;
  onFeito: (e: HojeEntry) => void;
  busyId: string | null;
};

function PetFace({ pet, size }: { pet: PetCard; size: string }) {
  return (
    <PetAvatar
      name={pet.name}
      color={pet.color}
      photoUrl={pet.photoUrl}
      species={pet.species}
      petId={pet.id}
      ring={false}
      className={size}
    />
  );
}

/** Cartão grande (em atraso e hoje): toca-se para abrir o animal; «Feito» em baixo. */
function BigCard({
  entry,
  ctx,
  late,
}: {
  entry: HojeEntry;
  ctx: Ctx;
  late?: boolean;
}) {
  const pet = ctx.pets[entry.petId];
  if (!pet) return null;
  return (
    <li
      data-testid="hoje-item"
      className={cn(
        "flex flex-col gap-3 rounded-cartao border-[1.5px] bg-branco p-4",
        late ? "border-atraso-borda" : "border-linha",
      )}
    >
      <Link
        href={`/animais/${pet.id}`}
        className="focus-visible:shadow-foco -m-1 flex items-center gap-3 rounded-campo p-1 outline-none"
      >
        <PetFace pet={pet} size="size-[50px] text-[18px]" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span
            className={cn(
              "text-etiqueta font-extrabold",
              colorStyles[pet.color].text,
            )}
          >
            {pet.name}
          </span>
          <span className="text-seccao">{entry.title}</span>
          <span
            className={cn(
              "text-legenda",
              late ? "font-extrabold text-atraso" : "text-tinta-suave",
            )}
          >
            {whenLabel(entry, ctx.today)}
          </span>
        </span>
      </Link>
      <button
        type="button"
        disabled={ctx.busyId === entry.id}
        onClick={() => ctx.onFeito(entry)}
        className="focus-visible:shadow-foco flex h-feito w-full items-center justify-center gap-2 rounded-capsula bg-feito text-corpo font-extrabold text-branco outline-none active:translate-y-px disabled:opacity-60"
      >
        <Check className="size-6" strokeWidth={3} aria-hidden />
        Marcar como feito
      </button>
    </li>
  );
}

/** Linha compacta (próximos 30 dias). */
function Row({ entry, ctx }: { entry: HojeEntry; ctx: Ctx }) {
  const pet = ctx.pets[entry.petId];
  if (!pet) return null;
  return (
    <li
      data-testid="hoje-item"
      className="flex items-center gap-3 border-b-[1.5px] border-linha-suave px-4 py-3 last:border-b-0"
    >
      <Link
        href={`/animais/${pet.id}`}
        className="focus-visible:shadow-foco -m-1 flex min-w-0 flex-1 items-center gap-3 rounded-campo p-1 outline-none"
      >
        <PetFace pet={pet} size="size-[42px] text-[16px]" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[17px] font-bold">{entry.title}</span>
          <span className="truncate text-legenda text-tinta-suave">
            <b className={colorStyles[pet.color].text}>{pet.name}</b> ·{" "}
            {whenLabel(entry, ctx.today)}
          </span>
        </span>
      </Link>
      <button
        type="button"
        disabled={ctx.busyId === entry.id}
        onClick={() => ctx.onFeito(entry)}
        className="focus-visible:shadow-foco h-chip shrink-0 rounded-capsula bg-feito-fundo px-5 text-etiqueta font-extrabold text-feito-texto outline-none active:translate-y-px disabled:opacity-60"
      >
        Feito
      </button>
    </li>
  );
}

function DoneBanner({
  entry,
  ctx,
  who,
  onUndo,
}: {
  entry: HojeEntry;
  ctx: Ctx;
  who: string;
  onUndo: () => void;
}) {
  const pet = ctx.pets[entry.petId];
  if (!pet) return null;
  // Tratamentos já geraram um registo novo: não se desfazem daqui (edita-se na ficha).
  const canUndo = entry.kind !== "treatment";
  return (
    <li
      data-testid="hoje-feito"
      className="flex items-center gap-3 rounded-cartao bg-feito-fundo py-2 pr-2 pl-4"
    >
      <Check
        className="size-6 shrink-0 text-feito-texto"
        strokeWidth={3}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-corpo font-bold">
          {entry.title} · {pet.name}
        </p>
        <p className="text-legenda text-feito-texto">
          Feito por {who} · {agoLabel(entry.doneAt ?? "", ctx.nowMs)}
        </p>
      </div>
      {canUndo ? (
        <button
          type="button"
          onClick={onUndo}
          className="focus-visible:shadow-foco h-11 shrink-0 rounded-capsula px-3 text-etiqueta font-extrabold text-feito-texto outline-none"
        >
          Desfazer
        </button>
      ) : null}
    </li>
  );
}

function Section({
  title,
  count,
  late,
  children,
}: {
  title: string;
  count?: number;
  late?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2
        className={cn(
          "flex items-center gap-2 text-seccao",
          late && "text-atraso",
        )}
      >
        {count ? (
          <span className="flex h-7 min-w-7 items-center justify-center rounded-capsula bg-atraso px-2 text-etiqueta text-branco">
            {count}
          </span>
        ) : null}
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Confirmação rápida de «Feito» para lembretes sem registo (medicação, manuais), vinda de uma notificação. */
function ConfirmFeitoSheet({
  entry,
  pet,
  busy,
  error,
  onConfirm,
  onClose,
}: {
  entry: HojeEntry;
  pet: PetCard;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title="Marcar como feito?"
    >
      <div className="flex items-center gap-3">
        <PetFace pet={pet} size="size-14 text-[20px]" />
        <div className="min-w-0">
          <p
            className={cn(
              "text-etiqueta font-extrabold",
              colorStyles[pet.color].text,
            )}
          >
            {pet.name}
          </p>
          <p className="text-seccao">{entry.title}</p>
        </div>
      </div>
      {error ? (
        <p role="alert" className="text-etiqueta text-atraso">
          {error}
        </p>
      ) : null}
      <Button size="feito" onClick={onConfirm} disabled={busy}>
        <Check className="size-6" strokeWidth={3} aria-hidden />
        Marcar como feito
      </Button>
    </Sheet>
  );
}

export function HojeList({
  focusId = null,
  groups,
  pets,
  treatments,
  names,
  today,
  nowMs,
  allClear,
  clearAction,
}: {
  /** `?ocorrencia=<id>` (notificação ou email): abre logo a confirmação dessa ocorrência. */
  focusId?: string | null;
  groups: HojeGroups;
  pets: Record<string, PetCard>;
  treatments: Record<string, TreatmentInfo>;
  names: Record<string, string>;
  today: string;
  nowMs: number;
  allClear: React.ReactNode;
  clearAction: React.ReactNode;
}) {
  const router = useRouter();
  const pendingEntries = [
    ...groups.overdue,
    ...groups.today,
    ...groups.upcoming,
  ];
  const focused = focusId
    ? pendingEntries.find((e) => e.id === focusId)
    : undefined;
  const [sheet, setSheet] = useState<HojeEntry | null>(
    focused && treatments[focused.id] ? focused : null,
  );
  const [confirm, setConfirm] = useState<HojeEntry | null>(
    focused && !treatments[focused.id] ? focused : null,
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function feito(e: HojeEntry) {
    if (treatments[e.id]) {
      setSheet(e);
      return;
    }
    setBusyId(e.id);
    setError(null);
    startTransition(async () => {
      const res = await safely(() => completeOccurrence(e.id));
      if (!res.ok) setError(res.message);
      setBusyId(null);
    });
  }

  function undo(e: HojeEntry) {
    setBusyId(e.id);
    startTransition(async () => {
      const res = await safely(() => undoOccurrence(e.id));
      if (!res.ok) setError(res.message);
      setBusyId(null);
    });
  }

  // Tira o `?ocorrencia=` do endereço ao fechar, para um refresh não voltar a abrir.
  function closeFocus() {
    setSheet(null);
    setConfirm(null);
    if (focusId) router.replace("/");
  }

  function confirmFeito(e: HojeEntry) {
    setBusyId(e.id);
    setError(null);
    startTransition(async () => {
      const res = await safely(() => completeOccurrence(e.id));
      setBusyId(null);
      if (!res.ok) setError(res.message);
      else closeFocus();
    });
  }

  const ctx: Ctx = { pets, treatments, today, nowMs, onFeito: feito, busyId };
  const pending = groups.overdue.length + groups.today.length;
  const sheetPet = sheet ? pets[sheet.petId] : undefined;
  const sheetInfo = sheet ? treatments[sheet.id] : undefined;

  return (
    <>
      {error ? (
        <p role="alert" className="text-etiqueta text-atraso">
          {error}
        </p>
      ) : null}

      {groups.overdue.length ? (
        <Section title="Em atraso" count={groups.overdue.length} late>
          <ul className="flex flex-col gap-3">
            {groups.overdue.map((e) => (
              <BigCard key={e.id} entry={e} ctx={ctx} late />
            ))}
          </ul>
        </Section>
      ) : null}

      {groups.today.length || groups.recentlyDone.length ? (
        <Section title="Hoje">
          <ul className="flex flex-col gap-3">
            {groups.today.map((e) => (
              <BigCard key={e.id} entry={e} ctx={ctx} />
            ))}
            {groups.recentlyDone.map((e) => (
              <DoneBanner
                key={e.id}
                entry={e}
                ctx={ctx}
                who={
                  e.doneBy
                    ? (names[e.doneBy] ?? "outra pessoa")
                    : DELETED_ACCOUNT
                }
                onUndo={() => undo(e)}
              />
            ))}
          </ul>
        </Section>
      ) : null}

      {pending === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-cartao bg-menta px-5 py-8 text-center">
          {allClear}
          {clearAction}
        </div>
      ) : null}

      {groups.upcoming.length ? (
        <Section title="Próximos 30 dias">
          <ul className="overflow-hidden rounded-cartao border-[1.5px] border-linha bg-branco">
            {groups.upcoming.map((e) => (
              <Row key={e.id} entry={e} ctx={ctx} />
            ))}
          </ul>
        </Section>
      ) : null}

      {sheet && sheetPet && sheetInfo ? (
        <FeitoSheet
          key={sheet.id}
          open
          onOpenChange={(o) => !o && closeFocus()}
          occurrenceId={sheet.id}
          pet={sheetPet}
          info={sheetInfo}
          today={today}
        />
      ) : null}

      {confirm && pets[confirm.petId] ? (
        <ConfirmFeitoSheet
          key={confirm.id}
          entry={confirm}
          pet={pets[confirm.petId]!}
          busy={busyId === confirm.id}
          error={error}
          onConfirm={() => confirmFeito(confirm)}
          onClose={closeFocus}
        />
      ) : null}
    </>
  );
}
