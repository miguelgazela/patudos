"use client";

import { Check, ChevronDown, Paperclip, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { ErrorBanner } from "@/components/auth/banner";
import { TextField } from "@/components/auth/text-field";
import { Chip, ConfirmDialog } from "@/components/consulta/ui";
import { PetAvatar } from "@/components/pets/pet-avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatISODate } from "@/lib/dates";
import { deleteExpense, saveExpense } from "@/lib/despesas/actions";
import {
  buildExpensePayload,
  draftParts,
  type ExpenseDraft,
} from "@/lib/despesas/payload";
import { centsToInput, splitEqually } from "@/lib/despesas/split";
import { EXPENSE_CATEGORY_LABEL } from "@/lib/ficha/labels";
import { resizeToJpeg } from "@/lib/pets/resize-image";
import { createClient } from "@/lib/supabase/client";
import { formatCents } from "@/lib/units";
import type { FormPet } from "@/lib/vet-visits/data";
import { EXPENSE_CATEGORIES } from "@/lib/vet-visits/schema";
import { cn } from "@/lib/utils";

const MAX_ATTACHMENT = 10 * 1024 * 1024;

export type ExpenseInitial = {
  id: string;
  amountCents: number;
  category: string;
  spentOn: string;
  description: string | null;
  paidBy: string | null;
  paidByName: string | null;
  visitHref: string | null;
  document: { id: string; url: string | null } | null;
  splits: { petId: string; cents: number }[];
  /** Há partes de animais que o utilizador não vê: total e animais ficam como estão. */
  locked: boolean;
};

type Attachment = { file: File; name: string };

function initialDraft(
  props: { initialPetIds: string[]; meId: string; today: string },
  init?: ExpenseInitial,
): ExpenseDraft {
  if (!init) {
    return {
      amount: "",
      category: null,
      petIds: props.initialPetIds,
      custom: null,
      date: props.today,
      paidBy: props.meId,
      description: "",
      documentId: null,
    };
  }
  const petIds = init.splits.map((s) => s.petId);
  const equal = splitEqually(init.amountCents, petIds).every(
    (p, i) => p.cents === init.splits[i]?.cents,
  );
  return {
    id: init.id,
    amount: centsToInput(init.amountCents),
    category: (EXPENSE_CATEGORIES as readonly string[]).includes(init.category)
      ? (init.category as ExpenseDraft["category"])
      : "other",
    petIds,
    custom:
      equal || init.locked
        ? null
        : Object.fromEntries(
            init.splits.map((s) => [s.petId, centsToInput(s.cents)]),
          ),
    date: init.spentOn,
    paidBy: init.paidBy,
    description: init.description ?? "",
    documentId: init.document?.id ?? null,
    ...(init.locked ? { lockedAmountCents: init.amountCents } : {}),
  };
}

/** Ecrã 26 — Nova / editar despesa. */
export function ExpenseForm(props: {
  pets: FormPet[];
  meId: string;
  initialPetIds: string[];
  today: string;
  initial?: ExpenseInitial;
}) {
  const { pets, meId, today, initial } = props;
  const router = useRouter();
  const [d, setD] = useState<ExpenseDraft>(() => initialDraft(props, initial));
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [done, setDone] = useState<{ cents: number; names: string } | null>(
    null,
  );
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const uploaded = useRef<{ petId: string; id: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const locked = d.lockedAmountCents !== undefined;
  const set = <K extends keyof ExpenseDraft>(k: K, v: ExpenseDraft[K]) =>
    setD((p) => ({ ...p, [k]: v }));

  const dirty = !initial && (d.amount !== "" || d.description !== "");
  useEffect(() => {
    if (!dirty || done) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, done]);

  const selected = pets.filter((p) => d.petIds.includes(p.id));
  // Quem pode ter pago: eu e quem partilha os animais escolhidos (mais o pagador atual, em edição).
  const payers = new Map<string, string>([[meId, "Eu"]]);
  for (const p of selected.length ? selected : pets) {
    for (const m of p.members) payers.set(m.id, m.name);
  }
  if (d.paidBy && !payers.has(d.paidBy)) {
    payers.set(d.paidBy, initial?.paidByName ?? "Outra pessoa");
  }

  function togglePet(id: string) {
    setErrors({});
    setD((p) => {
      const has = p.petIds.includes(id);
      if (has && p.petIds.length === 1) return p;
      return {
        ...p,
        petIds: has ? p.petIds.filter((x) => x !== id) : [...p.petIds, id],
        custom: null,
      };
    });
  }

  const parts = draftParts(d);

  async function pickFile(file: File | undefined) {
    if (!file) return;
    setAttachError(null);
    if (file.type === "application/pdf") {
      if (file.size > MAX_ATTACHMENT) {
        setAttachError("O PDF é demasiado grande (máximo 10 MB).");
        return;
      }
      setAttachment({ file, name: file.name });
    } else {
      try {
        const jpeg = await resizeToJpeg(file, 2000);
        setAttachment({
          file: new File([jpeg], "fatura.jpg", { type: "image/jpeg" }),
          name: "Foto",
        });
      } catch {
        setAttachError("Não conseguimos usar esse ficheiro. Tenta outro.");
        return;
      }
    }
    uploaded.current = null;
    set("documentId", null);
  }

  async function uploadAttachment(petId: string): Promise<string | null> {
    if (!attachment) return d.documentId;
    if (uploaded.current?.petId === petId) return uploaded.current.id;
    const supabase = createClient();
    const isPdf = attachment.file.type === "application/pdf";
    const path = `${petId}/${crypto.randomUUID()}.${isPdf ? "pdf" : "jpg"}`;
    const up = await supabase.storage
      .from("documentos")
      .upload(path, attachment.file, {
        contentType: attachment.file.type,
        cacheControl: "3600",
      });
    if (up.error) throw new Error("upload");
    const row = await supabase
      .from("documents")
      .insert({
        pet_id: petId,
        kind: "invoice",
        title: d.description.trim() || "Fatura",
        storage_path: path,
        mime_type: attachment.file.type,
        document_date: d.date || null,
      })
      .select("id")
      .single();
    if (row.error || !row.data) {
      await supabase.storage.from("documentos").remove([path]);
      throw new Error("document");
    }
    uploaded.current = { petId, id: row.data.id };
    return row.data.id;
  }

  function onSubmit() {
    if (pending) return;
    const check = buildExpensePayload(d, today);
    setErrors(check.errors);
    if (!check.payload) {
      setServerError("Confirma os campos assinalados.");
      return;
    }
    setServerError(null);
    startTransition(async () => {
      try {
        const petId = d.petIds[0] ?? initial?.splits[0]?.petId;
        const documentId = petId ? await uploadAttachment(petId) : null;
        const { payload } = buildExpensePayload({ ...d, documentId }, today);
        if (!payload) return;
        const res = await saveExpense(payload);
        if (!res.ok) {
          setErrors(res.errors ?? {});
          setServerError(res.message);
          return;
        }
        if (initial) {
          router.replace(`/despesas?p=${payload.spent_on.slice(0, 7)}`);
          return;
        }
        setDone({
          cents: payload.amount_cents,
          names: selected.map((p) => p.name).join(", "),
        });
        window.scrollTo({ top: 0 });
      } catch {
        setServerError(
          attachment
            ? "Não conseguimos enviar a fatura. Os dados continuam aqui; tenta de novo."
            : "Não conseguimos guardar. Os dados continuam aqui; tenta de novo.",
        );
      }
    });
  }

  function onDelete() {
    if (!initial) return;
    startTransition(async () => {
      const res = await deleteExpense(initial.id);
      setDeleteOpen(false);
      if (!res.ok) {
        setServerError(res.message);
        return;
      }
      router.replace("/despesas");
    });
  }

  if (done) {
    return (
      <div
        className="flex flex-1 flex-col gap-5 pt-6"
        data-testid="expense-saved"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-20 items-center justify-center rounded-full bg-feito-fundo text-feito">
            <Check className="size-10" strokeWidth={3} aria-hidden />
          </span>
          <h1 className="text-titulo tracking-tight">Despesa guardada</h1>
          <p className="text-corpo text-tinta-suave">
            {formatCents(done.cents)} · {done.names}
          </p>
        </div>
        <div className="mt-2 flex flex-col gap-1">
          <Button
            type="button"
            onClick={() => {
              setDone(null);
              setD(initialDraft(props));
              setAttachment(null);
              uploaded.current = null;
            }}
          >
            Registar outra
          </Button>
          <Link
            href="/despesas"
            className={buttonVariants({ variant: "link" })}
          >
            Ver despesas
          </Link>
        </div>
      </div>
    );
  }

  const payerLabel =
    d.paidBy === meId
      ? "pago por ti"
      : `pago por ${payers.get(d.paidBy ?? "") ?? "outra pessoa"}`;
  const hasInvoice = attachment !== null || d.documentId !== null;

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
          {initial ? "Editar despesa" : "Nova despesa"}
        </h1>
      </header>

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="flex flex-col gap-5 pb-32"
      >
        {serverError ? <ErrorBanner>{serverError}</ErrorBanner> : null}

        {initial?.visitHref ? (
          <Link
            href={initial.visitHref}
            className="text-etiqueta font-extrabold text-pinheiro underline underline-offset-4"
          >
            Despesa criada numa consulta: ver consulta
          </Link>
        ) : null}

        <div className="flex flex-col gap-2">
          <label htmlFor="amount" className="text-etiqueta">
            Valor
          </label>
          {locked ? (
            <p className="rounded-campo bg-aviso-fundo p-3 text-legenda text-aviso">
              Esta despesa inclui animais de outras pessoas, por isso o valor e
              os animais não se alteram aqui. A tua parte:{" "}
              {formatCents(
                initial?.splits.reduce((s, x) => s + x.cents, 0) ?? 0,
              )}{" "}
              de {formatCents(d.lockedAmountCents ?? 0)}.
            </p>
          ) : (
            <div className="relative">
              <input
                id="amount"
                name="amount"
                inputMode="decimal"
                autoComplete="off"
                autoFocus={!initial}
                placeholder="0,00"
                value={d.amount}
                onChange={(e) => {
                  setD((p) => ({ ...p, amount: e.target.value, custom: null }));
                }}
                aria-invalid={errors.amount ? true : undefined}
                className="focus:shadow-foco h-[76px] w-full rounded-campo border-2 border-linha bg-branco pr-16 pl-4 text-[36px] font-extrabold tabular-nums outline-none placeholder:text-placeholder focus:border-pinheiro aria-invalid:border-atraso aria-invalid:bg-atraso-campo"
              />
              <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-[22px] font-bold text-tinta-suave">
                €
              </span>
            </div>
          )}
          {errors.amount ? (
            <p className="text-etiqueta text-atraso" role="alert">
              {errors.amount}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-etiqueta">Categoria</span>
          <div className="flex flex-wrap gap-2">
            {EXPENSE_CATEGORIES.map((c) => (
              <Chip
                key={c}
                selected={d.category === c}
                onClick={() => set("category", c)}
              >
                {EXPENSE_CATEGORY_LABEL[c]}
              </Chip>
            ))}
          </div>
          {errors.category ? (
            <p className="text-etiqueta text-atraso" role="alert">
              {errors.category}
            </p>
          ) : null}
        </div>

        {!locked ? (
          <div className="flex flex-col gap-2">
            <span className="text-etiqueta">Para quem?</span>
            <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
              {pets.map((p) => {
                const on = d.petIds.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => togglePet(p.id)}
                    className={cn(
                      "focus-visible:shadow-foco flex h-chip shrink-0 items-center gap-2 rounded-capsula pr-4 pl-1.5 text-etiqueta font-bold outline-none",
                      on
                        ? "bg-pinheiro text-branco"
                        : "bg-linha-suave text-tinta",
                    )}
                  >
                    <PetAvatar
                      name={p.name}
                      color={p.color}
                      photoUrl={p.photoUrl}
                      species={p.species}
                      petId={p.id}
                      ring={false}
                      className="size-9 text-[15px]"
                    />
                    {p.name}
                    {on ? (
                      <Check className="size-4" strokeWidth={3} aria-hidden />
                    ) : null}
                  </button>
                );
              })}
            </div>
            {pets.length > 1 ? (
              <p className="text-legenda text-tinta-suave">
                Escolhe mais de um para dividir.
              </p>
            ) : null}
            {errors.pets ? (
              <p className="text-etiqueta text-atraso" role="alert">
                {errors.pets}
              </p>
            ) : null}
          </div>
        ) : null}

        {!locked && selected.length > 1 ? (
          <div
            className="flex flex-col gap-3 rounded-cartao border-[1.5px] border-linha bg-branco p-4"
            data-testid="split-card"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-corpo font-bold">
                {d.custom ? "Valores ajustados" : "Dividido em partes iguais"}
              </p>
              <button
                type="button"
                onClick={() =>
                  set(
                    "custom",
                    d.custom
                      ? null
                      : Object.fromEntries(
                          parts.map((p) => [
                            p.petId,
                            centsToInput(p.cents ?? 0),
                          ]),
                        ),
                  )
                }
                className="focus-visible:shadow-foco h-11 px-1 text-etiqueta font-extrabold text-pinheiro underline underline-offset-4 outline-none"
              >
                {d.custom ? "Partes iguais" : "Ajustar"}
              </button>
            </div>
            {selected.map((p) => {
              const cents = parts.find((x) => x.petId === p.id)?.cents ?? 0;
              return (
                <div key={p.id} className="flex items-center gap-3">
                  <PetAvatar
                    name={p.name}
                    color={p.color}
                    photoUrl={p.photoUrl}
                    species={p.species}
                    petId={p.id}
                    ring={false}
                    className="size-9 text-[15px]"
                  />
                  <span className="min-w-0 flex-1 truncate text-corpo font-semibold">
                    {p.name}
                  </span>
                  {d.custom ? (
                    <div className="relative w-32">
                      <input
                        aria-label={`Valor para ${p.name}`}
                        inputMode="decimal"
                        autoComplete="off"
                        value={d.custom[p.id] ?? ""}
                        onChange={(e) =>
                          setD((prev) => ({
                            ...prev,
                            custom: { ...prev.custom, [p.id]: e.target.value },
                          }))
                        }
                        aria-invalid={
                          errors[`split.${p.id}`] ? true : undefined
                        }
                        className="focus:shadow-foco h-12 w-full rounded-campo border-2 border-linha bg-branco pr-8 pl-3 text-right text-corpo font-semibold tabular-nums outline-none focus:border-pinheiro aria-invalid:border-atraso"
                      />
                      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-tinta-suave">
                        €
                      </span>
                    </div>
                  ) : (
                    <span
                      className="text-corpo font-bold tabular-nums"
                      data-testid={`split-${p.name}`}
                    >
                      {formatCents(cents)}
                    </span>
                  )}
                </div>
              );
            })}
            {errors.splits ? (
              <p className="text-etiqueta text-atraso" role="alert">
                {errors.splits}
              </p>
            ) : null}
          </div>
        ) : null}

        <details className="group rounded-cartao border-[1.5px] border-linha bg-branco">
          <summary className="focus-visible:shadow-foco flex min-h-[64px] cursor-pointer list-none items-center gap-3 px-4 py-3 outline-none [&::-webkit-details-marker]:hidden">
            <span className="min-w-0 flex-1">
              <span className="block text-corpo font-bold">Mais detalhes</span>
              <span className="block text-legenda text-tinta-suave">
                {d.date === today ? "Hoje" : formatISODate(d.date)} ·{" "}
                {payerLabel} · {hasInvoice ? "com fatura" : "sem fatura"}
              </span>
            </span>
            <ChevronDown
              className="size-5 text-tinta-suave transition-transform group-open:rotate-180"
              aria-hidden
            />
          </summary>
          <div className="flex flex-col gap-5 px-4 pb-5">
            <TextField
              id="spent_on"
              name="spent_on"
              type="date"
              label={d.date === today ? "Data · hoje" : "Data"}
              max={today}
              value={d.date}
              onChange={(e) => set("date", e.target.value || today)}
            />
            {payers.size > 1 ? (
              <div className="flex flex-col gap-2">
                <span className="text-etiqueta">Pago por</span>
                <div className="flex flex-wrap gap-2">
                  {[...payers].map(([id, name]) => (
                    <Chip
                      key={id}
                      selected={d.paidBy === id}
                      onClick={() => set("paidBy", id)}
                    >
                      {name}
                    </Chip>
                  ))}
                </div>
              </div>
            ) : null}
            <TextField
              id="description"
              name="description"
              label="Descrição (opcional)"
              maxLength={120}
              autoComplete="off"
              value={d.description}
              onChange={(e) => set("description", e.target.value)}
            />
            <div className="flex flex-col gap-2">
              <span className="text-etiqueta">Fatura</span>
              {attachment ? (
                <p className="truncate text-legenda">
                  {attachment.name} ·{" "}
                  {(attachment.file.size / 1024 / 1024)
                    .toFixed(1)
                    .replace(".", ",")}{" "}
                  MB
                </p>
              ) : initial?.document && d.documentId ? (
                <p className="text-legenda">
                  {initial.document.url ? (
                    <a
                      href={initial.document.url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-extrabold text-pinheiro underline underline-offset-4"
                    >
                      Abrir fatura anexada
                    </a>
                  ) : (
                    "Fatura anexada"
                  )}
                </p>
              ) : null}
              <input
                ref={fileInput}
                type="file"
                accept="image/*,application/pdf"
                data-testid="attachment-input"
                className="sr-only"
                tabIndex={-1}
                onChange={(e) => {
                  void pickFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="focus-visible:shadow-foco flex h-12 items-center justify-center gap-2 rounded-capsula border-2 border-dashed border-[#9fb3ae] bg-branco text-etiqueta font-extrabold text-pinheiro outline-none"
              >
                <Paperclip className="size-5" strokeWidth={2.2} aria-hidden />
                {hasInvoice ? "Trocar fatura" : "Juntar foto ou PDF"}
              </button>
              {hasInvoice ? (
                <button
                  type="button"
                  onClick={() => {
                    setAttachment(null);
                    uploaded.current = null;
                    set("documentId", null);
                  }}
                  className="h-11 text-etiqueta font-extrabold text-atraso"
                >
                  Remover fatura
                </button>
              ) : null}
              {attachError ? (
                <p className="text-etiqueta text-atraso" role="alert">
                  {attachError}
                </p>
              ) : null}
            </div>
          </div>
        </details>

        {initial ? (
          <Button
            type="button"
            variant="destructive"
            onClick={() => setDeleteOpen(true)}
          >
            Apagar despesa
          </Button>
        ) : null}

        <div className="fixed inset-x-0 bottom-0 z-40 border-t-[1.5px] border-linha bg-branco">
          <div className="mx-auto flex w-full max-w-md flex-col gap-2 px-5 pt-3 pb-[max(env(safe-area-inset-bottom),12px)]">
            <Button type="submit" disabled={pending}>
              {pending ? "A guardar…" : "Guardar"}
            </Button>
          </div>
        </div>
      </form>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Apagar esta despesa?"
        confirmLabel="Apagar"
        cancelLabel="Cancelar"
        onConfirm={onDelete}
        pending={pending}
      >
        Esta ação não se pode desfazer.
      </ConfirmDialog>
    </>
  );
}
