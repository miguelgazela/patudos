"use client";

import { Clock } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { formatISODate } from "@/lib/dates";
import {
  endsOn,
  type Duration,
  type Frequency,
  type MedicationDraft,
} from "@/lib/vet-visits/schedule";
import { cn } from "@/lib/utils";

import type { MedicationItem } from "@/lib/vet-visits/draft";
import { Chip, Sheet, Switch } from "./ui";

const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: "daily1", label: "1× por dia" },
  { value: "daily2", label: "2× por dia" },
  { value: "every", label: "De X em X dias" },
  { value: "other", label: "Outra" },
];

const inputCls =
  "focus:shadow-foco h-campo w-full rounded-campo border-2 border-linha bg-branco px-4 text-corpo font-semibold outline-none focus:border-pinheiro aria-invalid:border-atraso aria-invalid:bg-atraso-campo";

/** Painel 15: medicação, com a frequência guardada em RRULE. */
export function MedicationSheet({
  open,
  onOpenChange,
  medicines,
  visitDate,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  medicines: string[];
  visitDate: string;
  onAdd: (item: MedicationItem) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Medicação">
      {open ? (
        <Body
          medicines={medicines}
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

function Body({
  medicines,
  visitDate,
  onAdd,
}: {
  medicines: string[];
  visitDate: string;
  onAdd: (item: MedicationItem) => void;
}) {
  const [name, setName] = useState("");
  const [dose, setDose] = useState("");
  const [d, setD] = useState<MedicationDraft>({
    frequency: "daily1",
    everyDays: 2,
    time: "08:00",
    time2: "20:00",
    duration: "days",
    days: 7,
    until: "",
    startsOn: visitDate,
  });
  const [otherFrequency, setOtherFrequency] = useState("");
  const [remind, setRemind] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof MedicationDraft>(k: K, v: MedicationDraft[K]) =>
    setD((p) => ({ ...p, [k]: v }));

  const last = endsOn(d);

  function add() {
    if (!name.trim()) {
      setError("Escreve o nome do medicamento.");
      return;
    }
    if (d.duration === "days" && d.days < 1) {
      setError("Escreve quantos dias.");
      return;
    }
    if (d.duration === "until" && !d.until) {
      setError("Escolhe até que dia.");
      return;
    }
    onAdd({
      kind: "medication",
      key: crypto.randomUUID(),
      name: name.trim(),
      dose: dose.trim(),
      draft: d,
      otherFrequency: otherFrequency.trim(),
      remind: d.frequency === "other" ? false : remind,
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-3">
        <div className="flex flex-col gap-2">
          <label htmlFor="med-name" className="text-etiqueta">
            Medicamento
          </label>
          <input
            id="med-name"
            list="medicines"
            value={name}
            maxLength={80}
            autoComplete="off"
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            aria-invalid={error && !name.trim() ? true : undefined}
            className={inputCls}
          />
          <datalist id="medicines">
            {medicines.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="med-dose" className="text-etiqueta">
            Dose
          </label>
          <input
            id="med-dose"
            value={dose}
            maxLength={60}
            autoComplete="off"
            placeholder="½ comp."
            onChange={(e) => setDose(e.target.value)}
            className={cn(inputCls, "placeholder:text-placeholder")}
          />
        </div>
      </div>
      {error ? (
        <p className="text-etiqueta text-atraso" role="alert">
          {error}
        </p>
      ) : null}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-etiqueta">Quantas vezes?</legend>
        <div className="flex flex-wrap gap-2">
          {FREQUENCIES.map((f) => (
            <Chip
              key={f.value}
              selected={d.frequency === f.value}
              onClick={() => set("frequency", f.value)}
            >
              {f.label}
            </Chip>
          ))}
        </div>
        {d.frequency === "every" ? (
          <div className="mt-2 flex items-center gap-3">
            <span className="text-corpo font-semibold">De</span>
            <input
              aria-label="Número de dias entre tomas"
              inputMode="numeric"
              pattern="[0-9]*"
              value={d.everyDays || ""}
              onChange={(e) =>
                set(
                  "everyDays",
                  Math.min(60, Number(e.target.value.replace(/\D/g, "")) || 0),
                )
              }
              className={cn(
                inputCls,
                "w-24 text-center text-[22px] font-extrabold",
              )}
            />
            <span className="text-corpo font-semibold">em</span>
            <span className="text-corpo font-semibold">dias</span>
          </div>
        ) : null}
        {d.frequency === "other" ? (
          <input
            aria-label="Descreve a frequência"
            placeholder="Ex.: uma vez por semana"
            value={otherFrequency}
            maxLength={120}
            onChange={(e) => setOtherFrequency(e.target.value)}
            className={cn(inputCls, "mt-2 placeholder:text-placeholder")}
          />
        ) : null}
      </fieldset>

      {d.frequency !== "other" ? (
        <div className="flex gap-3">
          {(d.frequency === "daily2"
            ? ([
                ["time", "1.ª toma"],
                ["time2", "2.ª toma"],
              ] as const)
            : ([["time", "A que horas?"]] as const)
          ).map(([key, label]) => (
            <div key={key} className="flex flex-1 flex-col gap-2">
              <label htmlFor={`med-${key}`} className="text-etiqueta">
                {label}
              </label>
              <div className="relative">
                <Clock
                  className="pointer-events-none absolute top-1/2 left-4 size-[22px] -translate-y-1/2 text-pinheiro"
                  strokeWidth={2.2}
                  aria-hidden
                />
                <input
                  id={`med-${key}`}
                  type="time"
                  value={d[key]}
                  onChange={(e) => set(key, e.target.value)}
                  className={cn(inputCls, "pr-3 pl-12")}
                />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-etiqueta">Durante quanto tempo?</legend>
        <div
          role="radiogroup"
          aria-label="Duração"
          className="grid grid-cols-3 gap-1 rounded-capsula bg-linha-suave p-1"
        >
          {(
            [
              { value: "days", label: "N.º de dias" },
              { value: "until", label: "Até data" },
              { value: "ongoing", label: "Sempre" },
            ] as { value: Duration; label: string }[]
          ).map((o) => (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={d.duration === o.value}
              onClick={() => set("duration", o.value)}
              className={cn(
                "focus-visible:shadow-foco h-11 rounded-capsula text-etiqueta font-bold outline-none",
                d.duration === o.value
                  ? "shadow-segmento bg-branco text-tinta"
                  : "text-tinta-suave",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
        {d.duration === "days" ? (
          <div className="flex items-center gap-3">
            <input
              aria-label="Número de dias"
              inputMode="numeric"
              pattern="[0-9]*"
              value={d.days || ""}
              onChange={(e) =>
                set(
                  "days",
                  Math.min(365, Number(e.target.value.replace(/\D/g, "")) || 0),
                )
              }
              className={cn(
                inputCls,
                "w-28 text-center text-[22px] font-extrabold",
              )}
            />
            <p className="text-legenda text-tinta-suave">
              dias{last ? ` · última toma a ${formatISODate(last)}` : ""}
            </p>
          </div>
        ) : null}
        {d.duration === "until" ? (
          <input
            type="date"
            aria-label="Última toma"
            min={visitDate}
            value={d.until}
            onChange={(e) => set("until", e.target.value)}
            className={inputCls}
          />
        ) : null}
      </fieldset>

      {d.frequency !== "other" ? (
        <div className="flex items-center justify-between gap-3 rounded-cartao border-[1.5px] border-linha px-4 py-3">
          <div>
            <p className="text-corpo font-bold">Lembrar cada toma</p>
            <p className="text-legenda text-tinta-suave">
              {d.frequency === "daily2"
                ? `Às ${d.time} e às ${d.time2}`
                : `Às ${d.time}`}
            </p>
          </div>
          <Switch
            checked={remind}
            onChange={setRemind}
            label="Lembrar cada toma"
          />
        </div>
      ) : null}

      <Button type="button" onClick={add}>
        Adicionar
      </Button>
    </div>
  );
}
