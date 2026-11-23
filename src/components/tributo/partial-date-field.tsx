"use client";

import { useState } from "react";

import { TextField } from "@/components/auth/text-field";
import { lisbonToday } from "@/lib/pets/age";
import { convertPartial, type Precision } from "@/lib/pets/tribute";
import { cn } from "@/lib/utils";

const OPTIONS: { value: Precision; label: string; field: string }[] = [
  { value: "day", label: "Dia", field: "Data" },
  { value: "month", label: "Mês", field: "Mês e ano" },
  { value: "year", label: "Ano", field: "Ano" },
];

/**
 * Data que pode ser aproximada: dia exato, só mês e ano, ou só o ano.
 * Envia `{name}` («2026-09-12», «2026-09» ou «2026») e `{name}_precision`.
 */
export function PartialDateField({
  name,
  legend,
  defaultValue = "",
  defaultPrecision = "day",
  error,
  help,
  required,
}: {
  name: string;
  legend: string;
  defaultValue?: string;
  defaultPrecision?: Precision;
  error?: string;
  help?: string;
  required?: boolean;
}) {
  const [precision, setPrecision] = useState<Precision>(defaultPrecision);
  const [value, setValue] = useState(
    convertPartial(defaultValue, defaultPrecision),
  );
  const today = lisbonToday();
  const current = OPTIONS.find((o) => o.value === precision)!;

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-2 text-etiqueta">{legend}</legend>
      <input type="hidden" name={`${name}_precision`} value={precision} />
      <div
        role="radiogroup"
        aria-label={`${legend}: como queres indicar`}
        className="grid grid-cols-3 gap-1 rounded-capsula bg-linha-suave p-1"
      >
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={precision === o.value}
            onClick={() => {
              setPrecision(o.value);
              setValue((v) => convertPartial(v, o.value));
            }}
            className={cn(
              "focus-visible:shadow-foco h-11 rounded-capsula text-etiqueta font-bold outline-none",
              precision === o.value
                ? "shadow-segmento bg-branco text-tinta"
                : "text-tinta-suave",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      <TextField
        key={precision}
        id={name}
        name={name}
        label={current.field}
        type={
          precision === "day"
            ? "date"
            : precision === "month"
              ? "month"
              : "text"
        }
        inputMode={precision === "year" ? "numeric" : undefined}
        pattern={precision === "year" ? "[0-9]{4}" : undefined}
        maxLength={precision === "year" ? 4 : undefined}
        placeholder={precision === "year" ? "2026" : undefined}
        max={
          precision === "day"
            ? today
            : precision === "month"
              ? today.slice(0, 7)
              : undefined
        }
        autoComplete="off"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        error={error}
        help={help}
        required={required}
      />
    </fieldset>
  );
}
