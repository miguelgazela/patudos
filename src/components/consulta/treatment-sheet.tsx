"use client";

import { CalendarDays } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { formatISODate } from "@/lib/dates";
import { suggestNextDue } from "@/lib/vet-visits/next-due";
import type { FormPreset } from "@/lib/vet-visits/data";
import { cn } from "@/lib/utils";

import type { TreatmentItem } from "@/lib/vet-visits/draft";
import { Sheet, Switch } from "./ui";

type Tab = "vaccine" | "deworming";
const OTHER = "other";

function intervalLabel(months: number): string {
  if (months % 12 === 0)
    return months === 12 ? "anual" : `${months / 12} em ${months / 12} anos`;
  return months === 1 ? "mensal" : `${months} em ${months} meses`;
}

/** Painel 14: vacina ou desparasitação, com presets por espécie. */
export function TreatmentSheet({
  open,
  onOpenChange,
  initialTab,
  species,
  presets,
  products,
  visitDate,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab: Tab;
  species: "dog" | "cat";
  presets: FormPreset[];
  products: string[];
  visitDate: string;
  onAdd: (item: TreatmentItem) => void;
}) {
  // O conteúdo remonta ao abrir (key), por isso o estado começa sempre limpo.
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Vacina ou desparasitação"
    >
      {open ? (
        <TreatmentBody
          key={initialTab}
          initialTab={initialTab}
          species={species}
          presets={presets}
          products={products}
          visitDate={visitDate}
          onAdd={(item) => {
            onAdd(item);
            onOpenChange(false);
          }}
        />
      ) : null}
    </Sheet>
  );
}

/** Campos do painel 14, reutilizados no ecrã 16 (com barra fixa e campos extra). */
export function TreatmentBody({
  initialTab,
  species,
  presets,
  products,
  visitDate,
  onAdd,
  submitLabel = "Adicionar",
  fixedFooter = false,
  pending = false,
  extra,
  banner,
}: {
  initialTab: Tab;
  species: "dog" | "cat";
  presets: FormPreset[];
  products: string[];
  visitDate: string;
  onAdd: (item: TreatmentItem) => void;
  submitLabel?: string;
  /** Botão numa barra fixa no fundo (ecrã 16) em vez de no fim do painel. */
  fixedFooter?: boolean;
  pending?: boolean;
  /** Campos extra antes do botão (custo). */
  extra?: React.ReactNode;
  banner?: React.ReactNode;
}) {
  const forSpecies = presets.filter((p) => p.species === species);
  const listFor = (tab: Tab) =>
    forSpecies.filter((p) =>
      tab === "vaccine" ? p.type === "vaccine" : p.type !== "vaccine",
    );

  const [tab, setTab] = useState<Tab>(initialTab);
  const [selected, setSelected] = useState<string>(
    listFor(initialTab)[0]?.id ?? OTHER,
  );
  const [otherName, setOtherName] = useState("");
  const [product, setProduct] = useState("");
  const [nextDue, setNextDue] = useState<string | null>(null);
  const [remind, setRemind] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const list = listFor(tab);
  const preset = list.find((p) => p.id === selected) ?? null;
  const suggested = preset
    ? suggestNextDue(visitDate, preset.intervalMonths)
    : "";
  const shownNext = nextDue ?? suggested;

  function pickTab(next: Tab) {
    setTab(next);
    setSelected(listFor(next)[0]?.id ?? OTHER);
    setNextDue(null);
    setError(null);
  }
  function pick(id: string) {
    setSelected(id);
    setNextDue(null);
    setError(null);
  }

  function add() {
    const title = preset ? preset.name : otherName.trim();
    if (!title) {
      setError("Escreve o nome.");
      return;
    }
    onAdd({
      kind: "treatment",
      key: crypto.randomUUID(),
      type: preset
        ? (preset.type as TreatmentItem["type"])
        : tab === "vaccine"
          ? "vaccine"
          : "other",
      title,
      presetId: preset?.id ?? null,
      product: product.trim(),
      intervalMonths: preset?.intervalMonths ?? null,
      nextDue: shownNext,
      nextDueManual: nextDue !== null,
      remind,
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        role="radiogroup"
        aria-label="Tipo"
        className="grid grid-cols-2 gap-1 rounded-capsula bg-linha-suave p-1"
      >
        {(
          [
            { value: "vaccine", label: "Vacinas" },
            { value: "deworming", label: "Desparasitações" },
          ] as const
        ).map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={tab === o.value}
            onClick={() => pickTab(o.value)}
            className={cn(
              "focus-visible:shadow-foco h-[42px] rounded-capsula text-etiqueta font-bold outline-none",
              tab === o.value
                ? "shadow-segmento bg-branco text-tinta"
                : "text-tinta-suave",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div
        role="radiogroup"
        aria-label={tab === "vaccine" ? "Vacinas" : "Desparasitações"}
        className="overflow-hidden rounded-cartao border-[1.5px] border-linha"
      >
        {[
          ...list.map((p) => ({
            id: p.id,
            name: p.name,
            months: p.intervalMonths,
          })),
          { id: OTHER, name: "Outra…", months: 0 },
        ].map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={selected === o.id}
            onClick={() => pick(o.id)}
            className={cn(
              "focus-visible:shadow-foco flex min-h-14 w-full items-center gap-3 border-b-[1.5px] border-linha-suave px-4 text-left text-[16px] font-bold outline-none last:border-b-0",
              selected === o.id && "bg-[#eef8f5]",
            )}
          >
            <span
              className={cn(
                "size-6 shrink-0 rounded-full border-2",
                selected === o.id
                  ? "border-[7px] border-pinheiro"
                  : "border-[#9fb3ae]",
              )}
              aria-hidden
            />
            <span className="flex-1">{o.name}</span>
            {o.months ? (
              <span className="text-[13px] font-semibold text-tinta-suave">
                {intervalLabel(o.months)}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {!preset ? (
        <div className="flex flex-col gap-2">
          <label htmlFor="treatment-name" className="text-etiqueta">
            Nome
          </label>
          <input
            id="treatment-name"
            value={otherName}
            maxLength={80}
            autoComplete="off"
            onChange={(e) => {
              setOtherName(e.target.value);
              setError(null);
            }}
            aria-invalid={error ? true : undefined}
            className="focus:shadow-foco h-campo w-full rounded-campo border-2 border-linha bg-branco px-4 text-corpo font-semibold outline-none focus:border-pinheiro aria-invalid:border-atraso"
          />
          {error ? <p className="text-etiqueta text-atraso">{error}</p> : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <label htmlFor="treatment-product" className="text-etiqueta">
          Produto{" "}
          <span className="font-semibold text-tinta-suave">(opcional)</span>
        </label>
        <input
          id="treatment-product"
          list="products"
          value={product}
          maxLength={80}
          autoComplete="off"
          onChange={(e) => setProduct(e.target.value)}
          className="focus:shadow-foco h-campo w-full rounded-campo border-2 border-linha bg-branco px-4 text-corpo font-semibold outline-none focus:border-pinheiro"
        />
        <datalist id="products">
          {products.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="treatment-next" className="text-etiqueta">
          Próxima dose
        </label>
        <div className="relative">
          <CalendarDays
            className="pointer-events-none absolute top-1/2 left-4 size-[22px] -translate-y-1/2 text-pinheiro"
            strokeWidth={2.2}
            aria-hidden
          />
          <input
            id="treatment-next"
            type="date"
            min={visitDate}
            value={shownNext}
            onChange={(e) => setNextDue(e.target.value)}
            className="focus:shadow-foco h-campo w-full rounded-campo border-2 border-linha bg-branco pr-4 pl-12 text-corpo font-semibold outline-none focus:border-pinheiro"
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-legenda text-tinta-suave">
            {preset && nextDue === null
              ? `Sugerido: ${formatISODate(suggested)}`
              : "Podes deixar em branco."}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-etiqueta">Lembrar-me</span>
            <Switch checked={remind} onChange={setRemind} label="Lembrar-me" />
          </div>
        </div>
      </div>

      {extra}

      {fixedFooter ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t-[1.5px] border-linha bg-branco">
          <div className="mx-auto flex w-full max-w-md flex-col gap-2 px-5 pt-3 pb-[max(env(safe-area-inset-bottom),12px)]">
            {banner}
            <Button type="button" onClick={add} disabled={pending}>
              {pending ? "A guardar…" : submitLabel}
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" onClick={add}>
          {submitLabel}
        </Button>
      )}
    </div>
  );
}
