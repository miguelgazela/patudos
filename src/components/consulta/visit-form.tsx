"use client";

import {
  Bell,
  Check,
  ChevronDown,
  FlaskConical,
  Paperclip,
  Pill,
  Scale,
  Scissors,
  Stethoscope,
  Syringe,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { ErrorBanner } from "@/components/auth/banner";
import { TextField } from "@/components/auth/text-field";
import { PetAvatar } from "@/components/pets/pet-avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatISODate } from "@/lib/dates";
import { resizeToJpeg } from "@/lib/pets/resize-image";
import { createClient } from "@/lib/supabase/client";
import { formatCents, formatKg, parseEuroToCents, parseKg } from "@/lib/units";
import { saveVetVisit } from "@/lib/vet-visits/actions";
import type { FormPet, FormPreset } from "@/lib/vet-visits/data";
import type { Item, VisitDraft } from "@/lib/vet-visits/draft";
import { buildPayload, effectiveNextDue } from "@/lib/vet-visits/payload";
import { describeRRule, buildRRule } from "@/lib/vet-visits/schedule";
import { cn } from "@/lib/utils";

import { MedicationSheet } from "./medication-sheet";
import { TreatmentSheet } from "./treatment-sheet";
import {
  Chip,
  ConfirmDialog,
  PetPicker,
  ReasonField,
  Sheet,
  Switch,
  VetField,
} from "./ui";

const MAX_ATTACHMENT = 10 * 1024 * 1024;

type Attachment = { file: File; name: string };
type Done = {
  visitId: string;
  petId: string;
  petName: string;
  lines: string[];
  nextDates: { title: string; date: string }[];
};

/** Itens que criam uma próxima data. */
function nextDatesOf(d: VisitDraft) {
  return d.items.flatMap((i) =>
    i.kind === "treatment" && effectiveNextDue(i, d.visitDate)
      ? [{ item: i, date: effectiveNextDue(i, d.visitDate) }]
      : [],
  );
}

function treatmentCount(items: Item[]) {
  return items.filter((i) => i.kind === "treatment").length;
}

/** Ecrã 13 — Registar consulta. Tudo num só ecrã, gravado de uma vez. */
export function VisitForm(props: {
  pets: FormPet[];
  presets: FormPreset[];
  initialPetId: string;
  today: string;
  vets: string[];
  products: string[];
  medicines: string[];
}) {
  const { pets, presets, today } = props;
  const router = useRouter();
  const [d, setD] = useState<VisitDraft>(() => ({
    petId: props.initialPetId,
    visitDate: today,
    reason: "",
    vet: pets.find((p) => p.id === props.initialPetId)?.lastVet ?? "",
    items: [],
    weight: null,
    cost: "",
    paidBy: null,
    notes: "",
    documentId: null,
  }));
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [vetTouched, setVetTouched] = useState(false);
  const [sheet, setSheet] = useState<
    null | "vaccine" | "deworming" | "medication"
  >(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const [pending, startTransition] = useTransition();
  /** Documento já carregado (para não repetir o envio ao tentar de novo). */
  const uploaded = useRef<{ petId: string; id: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const weightInput = useRef<HTMLInputElement>(null);

  const pet = pets.find((p) => p.id === d.petId) ?? pets[0]!;
  const set = <K extends keyof VisitDraft>(k: K, v: VisitDraft[K]) =>
    setD((p) => ({ ...p, [k]: v }));

  const dirty =
    d.reason !== "" ||
    d.items.length > 0 ||
    d.weight !== null ||
    d.cost !== "" ||
    d.notes !== "" ||
    attachment !== null;

  useEffect(() => {
    if (!dirty || done) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, done]);

  function choosePet(id: string) {
    const next = pets.find((p) => p.id === id);
    if (!next || id === d.petId) return;
    setD((p) => ({
      ...p,
      petId: id,
      // O veterinário só muda sozinho enquanto ninguém lhe mexeu.
      vet: vetTouched ? p.vet : (next.lastVet ?? ""),
      paidBy: null,
      // O anexo carregado pertence à pasta do animal anterior.
      documentId: null,
    }));
    uploaded.current = null;
  }

  function addItem(item: Item) {
    setD((p) => ({ ...p, items: [...p.items, item] }));
  }
  function updateItem(key: string, patch: Partial<Item>) {
    setD((p) => ({
      ...p,
      items: p.items.map((i) =>
        i.key === key ? ({ ...i, ...patch } as Item) : i,
      ),
    }));
  }
  function removeItem(key: string) {
    setD((p) => ({ ...p, items: p.items.filter((i) => i.key !== key) }));
  }
  function addOther(type: "lab_test" | "surgery" | "other") {
    addItem({
      kind: "other",
      key: crypto.randomUUID(),
      type,
      title:
        type === "lab_test" ? "Análises" : type === "surgery" ? "Cirurgia" : "",
      notes: "",
    });
  }
  function addWeight() {
    set("weight", "");
    setTimeout(() => weightInput.current?.focus(), 50);
  }

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
          file: new File([jpeg], "anexo.jpg", { type: "image/jpeg" }),
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

  /** Valida; se faltar algo, mostra os erros e devolve `null`. */
  function validate() {
    const result = buildPayload(d);
    setErrors(result.errors);
    if (Object.keys(result.errors).length) {
      setServerError("Confirma os campos assinalados.");
      document
        .querySelector<HTMLElement>("[aria-invalid=true], [data-invalid=true]")
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
      return null;
    }
    setServerError(null);
    return result;
  }

  function onSubmit() {
    if (pending) return;
    const result = validate();
    if (!result) return;
    if (nextDatesOf(d).length > 0) setSummaryOpen(true);
    else void save();
  }

  async function uploadAttachment(): Promise<string | null> {
    if (!attachment) return null;
    if (uploaded.current?.petId === d.petId) return uploaded.current.id;
    const supabase = createClient();
    const isPdf = attachment.file.type === "application/pdf";
    const path = `${d.petId}/${crypto.randomUUID()}.${isPdf ? "pdf" : "jpg"}`;
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
        pet_id: d.petId,
        kind: "invoice",
        title: d.reason ? `${d.reason} · anexo` : "Anexo da consulta",
        storage_path: path,
        mime_type: attachment.file.type,
        document_date: d.visitDate || null,
      })
      .select("id")
      .single();
    if (row.error || !row.data) {
      await supabase.storage.from("documentos").remove([path]);
      throw new Error("document");
    }
    uploaded.current = { petId: d.petId, id: row.data.id };
    return row.data.id;
  }

  async function save() {
    setSummaryOpen(false);
    setServerError(null);
    startTransition(async () => {
      try {
        const documentId = await uploadAttachment();
        const draft = { ...d, documentId };
        const { payload, errors: errs } = buildPayload(draft);
        if (Object.keys(errs).length) {
          setErrors(errs);
          setServerError("Confirma os campos assinalados.");
          return;
        }
        const res = await saveVetVisit(payload);
        if (!res.ok) {
          setErrors(res.errors ?? {});
          setServerError(res.message);
          return;
        }
        setDone({
          visitId: res.visitId,
          petId: res.petId,
          petName: pet.name,
          lines: summaryLines(draft),
          nextDates: nextDatesOf(draft).map(({ item, date }) => ({
            title: item.title,
            date,
          })),
        });
        window.scrollTo({ top: 0 });
      } catch {
        setServerError(
          attachment
            ? "Não conseguimos enviar o anexo. Os dados continuam aqui; tenta de novo."
            : "Não conseguimos guardar. Os dados continuam aqui; tenta de novo.",
        );
      }
    });
  }

  function leave() {
    if (dirty) setLeaveOpen(true);
    else router.back();
  }

  if (done) return <Success done={done} />;

  const nextCount = nextDatesOf(d).length;
  const footerBits = [
    treatmentCount(d.items) > 0
      ? `${treatmentCount(d.items)} ${treatmentCount(d.items) === 1 ? "tratamento" : "tratamentos"}`
      : null,
    d.items.some((i) => i.kind === "medication") ? "medicação" : null,
    d.weight !== null ? "peso" : null,
    nextCount > 0
      ? `${nextCount} ${nextCount === 1 ? "próxima data" : "próximas datas"}`
      : null,
  ].filter(Boolean);
  const costValue = d.cost.trim();

  return (
    <>
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={leave}
          aria-label="Fechar"
          className="focus-visible:shadow-foco flex size-11 items-center justify-center rounded-full bg-linha-suave text-tinta outline-none"
        >
          <X className="size-6" strokeWidth={2.2} aria-hidden />
        </button>
        <h1 className="text-[22px] font-extrabold tracking-tight">
          Registar consulta
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
        {serverError ? (
          <ErrorBanner
            action={
              errors && Object.keys(errors).length === 0 ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="auto"
                  className="h-12 self-start"
                  onClick={onSubmit}
                >
                  Tentar outra vez
                </Button>
              ) : undefined
            }
          >
            {serverError}
          </ErrorBanner>
        ) : null}

        <PetPicker pets={pets} value={d.petId} onChange={choosePet} />

        <TextField
          id="visited_on"
          name="visited_on"
          type="date"
          label={d.visitDate === today ? "Data · hoje" : "Data"}
          max={today}
          value={d.visitDate}
          onChange={(e) => set("visitDate", e.target.value || today)}
          error={errors.visited_on}
        />

        <ReasonField
          value={d.reason}
          onChange={(v) => set("reason", v)}
          error={errors.reason}
        />

        <VetField
          value={d.vet}
          onChange={(v) => {
            setVetTouched(true);
            set("vet", v);
          }}
          suggestions={props.vets}
        />

        {/* O que foi feito? */}
        <section className="flex flex-col gap-3" aria-labelledby="feito">
          <h2 id="feito" className="text-seccao">
            O que foi feito?
          </h2>

          {d.items.map((item, idx) => (
            <ItemCard
              key={item.key}
              item={item}
              index={idx}
              visitDate={d.visitDate}
              errors={errors}
              onChange={(patch) => updateItem(item.key, patch)}
              onRemove={() => removeItem(item.key)}
            />
          ))}

          {d.weight !== null ? (
            <div
              className="flex items-start gap-3 rounded-cartao border-[1.5px] border-linha bg-branco p-3.5"
              data-testid="weight-card"
            >
              <CardIcon>
                <Scale className="size-5" strokeWidth={2.2} aria-hidden />
              </CardIcon>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <label htmlFor="weight" className="text-[17px] font-bold">
                  Peso
                </label>
                <div className="relative">
                  <input
                    id="weight"
                    ref={weightInput}
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder={
                      pet.lastWeight
                        ? String(pet.lastWeight.kg).replace(".", ",")
                        : "12,4"
                    }
                    value={d.weight}
                    onChange={(e) => set("weight", e.target.value)}
                    aria-invalid={errors.weight_kg ? true : undefined}
                    className="focus:shadow-foco h-[52px] w-full rounded-campo border-2 border-linha bg-branco pr-14 pl-4 text-[24px] font-extrabold outline-none placeholder:text-placeholder focus:border-pinheiro aria-invalid:border-atraso aria-invalid:bg-atraso-campo"
                  />
                  <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-corpo font-bold text-tinta-suave">
                    kg
                  </span>
                </div>
                {errors.weight_kg ? (
                  <p className="text-etiqueta text-atraso" role="alert">
                    {errors.weight_kg}
                  </p>
                ) : pet.lastWeight ? (
                  <p className="text-[13px] font-semibold text-tinta-suave">
                    Último: {formatKg(pet.lastWeight.kg)} ·{" "}
                    {formatISODate(pet.lastWeight.on).slice(0, 5)}
                  </p>
                ) : null}
              </div>
              <RemoveButton
                label="Remover peso"
                onClick={() => set("weight", null)}
              />
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <AddButton onClick={() => setSheet("vaccine")}>+ Vacina</AddButton>
            <AddButton onClick={() => setSheet("deworming")}>
              + Desparasitação
            </AddButton>
            <AddButton onClick={() => setSheet("medication")}>
              + Medicação
            </AddButton>
            {d.weight === null ? (
              <AddButton onClick={addWeight}>+ Peso</AddButton>
            ) : null}
            <AddButton onClick={() => addOther("lab_test")}>
              + Análises
            </AddButton>
            <AddButton onClick={() => addOther("surgery")}>
              + Cirurgia
            </AddButton>
            <AddButton onClick={() => addOther("other")}>+ Outro</AddButton>
          </div>
        </section>

        {/* Custo */}
        <section className="flex flex-col gap-3" aria-labelledby="custo">
          <h2 id="custo" className="text-seccao">
            Custo
          </h2>
          <div className="flex flex-col gap-2">
            <div className="relative">
              <input
                id="cost"
                aria-label="Custo em euros"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0,00"
                value={d.cost}
                onChange={(e) => set("cost", e.target.value)}
                aria-invalid={errors["expense.amount_cents"] ? true : undefined}
                className="focus:shadow-foco h-16 w-full rounded-campo border-2 border-linha bg-branco pr-14 pl-4 text-[28px] font-extrabold outline-none placeholder:text-placeholder focus:border-pinheiro aria-invalid:border-atraso aria-invalid:bg-atraso-campo"
              />
              <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-[22px] font-bold text-tinta-suave">
                €
              </span>
            </div>
            {errors["expense.amount_cents"] ? (
              <p className="text-etiqueta text-atraso" role="alert">
                {errors["expense.amount_cents"]}
              </p>
            ) : null}
          </div>
          {costValue !== "" && pet.members.length > 1 ? (
            <div className="flex flex-col gap-2">
              <span className="text-etiqueta">Pago por</span>
              <div className="flex flex-wrap gap-2">
                {pet.members.map((m) => (
                  <Chip
                    key={m.id}
                    selected={(d.paidBy ?? pet.members[0]!.id) === m.id}
                    onClick={() =>
                      set("paidBy", m.id === pet.members[0]!.id ? null : m.id)
                    }
                  >
                    {m.name}
                  </Chip>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        {/* Mais detalhes */}
        <details className="group rounded-cartao border-[1.5px] border-linha bg-branco">
          <summary className="focus-visible:shadow-foco flex min-h-16 cursor-pointer list-none items-center gap-3 rounded-cartao p-4 outline-none [&::-webkit-details-marker]:hidden">
            <span className="flex-1">
              <span className="block text-seccao">Mais detalhes</span>
              <span className="block text-legenda text-tinta-suave">
                Notas, fatura ou relatório
              </span>
            </span>
            <ChevronDown
              className="size-6 text-tinta-suave transition-transform group-open:rotate-180"
              strokeWidth={2.2}
              aria-hidden
            />
          </summary>
          <div className="flex flex-col gap-5 px-4 pb-5">
            <div className="flex flex-col gap-2">
              <label htmlFor="notes" className="text-etiqueta">
                Notas
              </label>
              <textarea
                id="notes"
                rows={3}
                maxLength={2000}
                value={d.notes}
                onChange={(e) => set("notes", e.target.value)}
                className="focus:shadow-foco w-full rounded-campo border-2 border-linha bg-branco px-4 py-3 text-corpo font-semibold outline-none focus:border-pinheiro"
              />
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-etiqueta">Anexo</span>
              {attachment ? (
                <div className="flex items-center gap-3 rounded-campo bg-nevoa p-2">
                  <span className="flex h-14 w-12 items-center justify-center rounded-[10px] border-[1.5px] border-linha bg-branco text-tinta-suave">
                    <Paperclip
                      className="size-5"
                      strokeWidth={2.2}
                      aria-hidden
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-etiqueta">{attachment.name}</p>
                    <p className="text-[13px] font-semibold text-tinta-suave">
                      {attachment.file.type === "application/pdf"
                        ? "PDF"
                        : "Foto"}{" "}
                      ·{" "}
                      {(attachment.file.size / 1024 / 1024)
                        .toFixed(1)
                        .replace(".", ",")}{" "}
                      MB
                    </p>
                  </div>
                  <RemoveButton
                    label="Remover anexo"
                    onClick={() => {
                      setAttachment(null);
                      uploaded.current = null;
                    }}
                  />
                </div>
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
                {attachment ? "Trocar anexo" : "Juntar foto ou PDF"}
              </button>
              {attachError ? (
                <p className="text-etiqueta text-atraso" role="alert">
                  {attachError}
                </p>
              ) : null}
            </div>
          </div>
        </details>

        {/* Barra fixa */}
        <div className="fixed inset-x-0 bottom-0 z-40 border-t-[1.5px] border-linha bg-branco">
          <div className="mx-auto flex w-full max-w-md flex-col gap-2 px-5 pt-3 pb-[max(env(safe-area-inset-bottom),12px)]">
            {footerBits.length > 0 || costValue ? (
              <div className="flex items-center justify-between gap-3 text-etiqueta font-semibold text-tinta-suave">
                <span className="leading-tight">{footerBits.join(" · ")}</span>
                {costValue && !errors["expense.amount_cents"] ? (
                  <b className="shrink-0 text-tinta">{costLabel(costValue)}</b>
                ) : null}
              </div>
            ) : null}
            <Button type="submit" disabled={pending}>
              {pending ? "A guardar…" : "Guardar consulta"}
            </Button>
          </div>
        </div>
      </form>

      <TreatmentSheet
        open={sheet === "vaccine" || sheet === "deworming"}
        onOpenChange={(o) => !o && setSheet(null)}
        initialTab={sheet === "deworming" ? "deworming" : "vaccine"}
        species={pet.species}
        presets={presets}
        products={props.products}
        visitDate={d.visitDate}
        onAdd={addItem}
      />
      <MedicationSheet
        open={sheet === "medication"}
        onOpenChange={(o) => !o && setSheet(null)}
        medicines={props.medicines}
        visitDate={d.visitDate}
        onAdd={addItem}
      />

      <Summary
        open={summaryOpen}
        onOpenChange={setSummaryOpen}
        draft={d}
        pet={pet}
        onChangeItem={updateItem}
        onSave={() => void save()}
      />

      <ConfirmDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        title="Sair sem guardar?"
        confirmLabel="Sair sem guardar"
        cancelLabel="Continuar a editar"
        onConfirm={() => {
          setLeaveOpen(false);
          router.back();
        }}
      >
        Esta consulta ainda não foi gravada. Se saíres agora, perdes o que
        escreveste.
      </ConfirmDialog>
    </>
  );
}

function costLabel(text: string): string {
  const cents = parseEuroToCents(text);
  return cents === null ? "" : formatCents(cents);
}

function summaryLines(d: VisitDraft): string[] {
  const lines: string[] = [];
  for (const i of d.items) {
    if (i.kind === "treatment") lines.push(i.title);
    else if (i.kind === "medication")
      lines.push(`${i.name}${i.dose ? ` · ${i.dose}` : ""}`);
    else lines.push(i.title || "Outro");
  }
  if (d.weight !== null) {
    const kg = parseKg(d.weight);
    if (kg) lines.push(`Peso ${formatKg(kg)}`);
  }
  const cents = parseEuroToCents(d.cost);
  if (cents) lines.push(`Custo ${formatCents(cents)}`);
  return lines;
}

function CardIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-menta text-pinheiro-escuro">
      {children}
    </span>
  );
}

function RemoveButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="focus-visible:shadow-foco flex size-11 shrink-0 items-center justify-center rounded-full bg-linha-suave text-tinta outline-none"
    >
      <X className="size-5" strokeWidth={2.4} aria-hidden />
    </button>
  );
}

function AddButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="focus-visible:shadow-foco h-12 rounded-capsula bg-menta px-3 text-etiqueta font-extrabold text-pinheiro-escuro outline-none active:translate-y-px"
    >
      {children}
    </button>
  );
}

const smallInput =
  "focus:shadow-foco h-12 w-full rounded-campo border-2 border-linha bg-branco px-3 text-[16px] font-semibold outline-none focus:border-pinheiro aria-invalid:border-atraso aria-invalid:bg-atraso-campo";

function ItemCard({
  item,
  index,
  visitDate,
  errors,
  onChange,
  onRemove,
}: {
  item: Item;
  index: number;
  visitDate: string;
  errors: Record<string, string>;
  onChange: (patch: Partial<Item>) => void;
  onRemove: () => void;
}) {
  if (item.kind === "treatment") {
    const next = effectiveNextDue(item, visitDate);
    return (
      <div className="flex items-start gap-3 rounded-cartao border-[1.5px] border-linha bg-branco p-3.5">
        <CardIcon>
          <Syringe className="size-5" strokeWidth={2.2} aria-hidden />
        </CardIcon>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="text-[17px] font-bold">{item.title}</p>
          {item.product ? (
            <p className="text-legenda text-tinta-suave">{item.product}</p>
          ) : null}
          {next ? (
            <span className="mt-1.5 inline-flex w-fit items-center gap-1.5 rounded-capsula bg-menta px-2.5 py-1 text-[13px] font-extrabold text-pinheiro-escuro">
              <Bell className="size-3.5" strokeWidth={2.4} aria-hidden />
              Próxima: {formatISODate(next)}
            </span>
          ) : null}
        </div>
        <RemoveButton label={`Remover ${item.title}`} onClick={onRemove} />
      </div>
    );
  }
  if (item.kind === "medication") {
    const freq =
      item.draft.frequency === "other"
        ? item.otherFrequency
        : describeRRule(buildRRule(item.draft));
    return (
      <div className="flex items-start gap-3 rounded-cartao border-[1.5px] border-linha bg-branco p-3.5">
        <CardIcon>
          <Pill className="size-5" strokeWidth={2.2} aria-hidden />
        </CardIcon>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="text-[17px] font-bold">{item.name}</p>
          <p className="text-legenda text-tinta-suave">
            {[item.dose, freq].filter(Boolean).join(" · ")}
          </p>
        </div>
        <RemoveButton label={`Remover ${item.name}`} onClick={onRemove} />
      </div>
    );
  }
  const Icon =
    item.type === "lab_test"
      ? FlaskConical
      : item.type === "surgery"
        ? Scissors
        : Stethoscope;
  const titleError = errors[`health_events.${index}.title`];
  return (
    <div className="flex items-start gap-3 rounded-cartao border-[1.5px] border-linha bg-branco p-3.5">
      <CardIcon>
        <Icon className="size-5" strokeWidth={2.2} aria-hidden />
      </CardIcon>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <input
          aria-label="Título"
          placeholder="O que foi feito?"
          value={item.title}
          maxLength={80}
          onChange={(e) => onChange({ title: e.target.value })}
          aria-invalid={titleError ? true : undefined}
          className={smallInput}
        />
        {titleError ? (
          <p className="text-etiqueta text-atraso" role="alert">
            {titleError}
          </p>
        ) : null}
        <input
          aria-label="Nota"
          placeholder="Nota (opcional)"
          value={item.notes}
          maxLength={500}
          onChange={(e) => onChange({ notes: e.target.value })}
          className={cn(smallInput, "placeholder:text-placeholder")}
        />
      </div>
      <RemoveButton
        label={`Remover ${item.title || "registo"}`}
        onClick={onRemove}
      />
    </div>
  );
}

/** E13c: próximas datas que vão ser criadas (editáveis) antes de gravar. */
function Summary({
  open,
  onOpenChange,
  draft,
  pet,
  onChangeItem,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  draft: VisitDraft;
  pet: FormPet;
  onChangeItem: (key: string, patch: Partial<Item>) => void;
  onSave: () => void;
}) {
  const lines = summaryLines(draft);
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Está tudo certo?"
      closeLabel="Voltar a editar"
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3 rounded-[20px] bg-menta p-3">
          <PetAvatar
            name={pet.name}
            color={pet.color}
            photoUrl={pet.photoUrl}
            species={pet.species}
            petId={pet.id}
            ring={false}
            className="size-13 text-[20px]"
          />
          <div className="min-w-0">
            <p className="truncate text-[17px] font-bold">
              {pet.name}
              {draft.reason ? ` · ${draft.reason}` : ""}
            </p>
            <p className="truncate text-legenda text-pinheiro-escuro">
              {formatISODate(draft.visitDate)}
              {draft.vet ? ` · ${draft.vet}` : ""}
            </p>
          </div>
        </div>

        <ul className="flex flex-col">
          {lines.map((l) => (
            <li
              key={l}
              className="flex items-center gap-2.5 py-1.5 text-[16px] font-semibold"
            >
              <Check
                className="size-5 shrink-0 text-feito"
                strokeWidth={3}
                aria-hidden
              />
              {l}
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-2">
          <h3 className="text-[17px] font-bold">Próximas datas criadas</h3>
          <div className="overflow-hidden rounded-cartao border-[1.5px] border-linha">
            {draft.items.flatMap((i) =>
              i.kind === "treatment" && effectiveNextDue(i, draft.visitDate) ? (
                <div
                  key={i.key}
                  className="flex items-center gap-3 border-b-[1.5px] border-linha-suave px-3.5 py-3 last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[16px] font-bold">{i.title}</p>
                    <input
                      type="date"
                      aria-label={`Próxima data de ${i.title}`}
                      min={draft.visitDate}
                      value={effectiveNextDue(i, draft.visitDate)}
                      onChange={(e) =>
                        onChangeItem(i.key, {
                          nextDue: e.target.value,
                          nextDueManual: true,
                        })
                      }
                      className="focus:shadow-foco mt-1 h-11 w-full rounded-campo border-2 border-linha bg-branco px-3 text-[15px] font-bold text-pinheiro outline-none focus:border-pinheiro"
                    />
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[13px] font-semibold text-tinta-suave">
                      Lembrar
                    </span>
                    <Switch
                      checked={i.remind}
                      onChange={(v) => onChangeItem(i.key, { remind: v })}
                      label={`Lembrar ${i.title}`}
                    />
                  </div>
                </div>
              ) : (
                []
              ),
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <Button type="button" onClick={onSave}>
            Guardar consulta
          </Button>
          <Button
            type="button"
            variant="link"
            onClick={() => onOpenChange(false)}
          >
            Voltar a editar
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

/** E13d: consulta gravada. */
function Success({ done }: { done: Done }) {
  return (
    <div className="flex flex-1 flex-col gap-5 pt-6" data-testid="visit-saved">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-20 items-center justify-center rounded-full bg-feito-fundo text-feito">
          <Check className="size-10" strokeWidth={3} aria-hidden />
        </span>
        <h1 className="text-titulo tracking-tight">Consulta guardada</h1>
        <p className="text-corpo text-tinta-suave">
          A consulta de {done.petName} ficou registada.
        </p>
      </div>

      {done.lines.length > 0 ? (
        <ul className="flex flex-col rounded-cartao border-[1.5px] border-linha bg-branco px-4 py-2">
          {done.lines.map((l) => (
            <li
              key={l}
              className="flex items-center gap-2.5 py-1.5 text-[16px] font-semibold"
            >
              <Check
                className="size-5 shrink-0 text-feito"
                strokeWidth={3}
                aria-hidden
              />
              {l}
            </li>
          ))}
        </ul>
      ) : null}

      {done.nextDates.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h2 className="text-[17px] font-bold">Próximas datas</h2>
          <ul className="flex flex-col rounded-cartao border-[1.5px] border-linha bg-branco px-4 py-2">
            {done.nextDates.map((n) => (
              <li
                key={n.title}
                className="flex items-center justify-between gap-3 py-1.5 text-[16px] font-semibold"
              >
                <span>{n.title}</span>
                <span className="font-extrabold text-pinheiro">
                  {formatISODate(n.date)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-2 flex flex-col gap-1">
        <Link href={`/animais/${done.petId}`} className={buttonVariants()}>
          Ver na cronologia
        </Link>
        <Link href="/" className={buttonVariants({ variant: "link" })}>
          Fechar
        </Link>
      </div>
    </div>
  );
}
