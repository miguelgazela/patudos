"use client";

import { safely } from "@/lib/client-action";
import { useState, useTransition } from "react";

import { ErrorBanner } from "@/components/auth/banner";
import { TextField } from "@/components/auth/text-field";
import { Chip, Sheet, Switch } from "@/components/consulta/ui";
import { PetAvatar } from "@/components/pets/pet-avatar";
import { Button } from "@/components/ui/button";
import { formatISODate } from "@/lib/dates";
import { completeTreatment } from "@/lib/lembretes/actions";
import type { TreatmentInfo } from "@/lib/lembretes/data";
import { colorStyles, type PetColor } from "@/lib/pets/constants";
import { addDaysISO, addMonthsISO } from "@/lib/vet-visits/next-due";
import { cn } from "@/lib/utils";

export type FeitoPet = {
  id: string;
  name: string;
  color: PetColor;
  photoUrl: string | null;
  species: string;
};

type When = "today" | "yesterday" | "other";

/** E05-Feito: confirmação rápida que regista o tratamento e propõe a próxima data. */
export function FeitoSheet({
  open,
  onOpenChange,
  occurrenceId,
  pet,
  info,
  today,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  occurrenceId: string;
  pet: FeitoPet;
  info: TreatmentInfo;
  today: string;
}) {
  const [when, setWhen] = useState<When>("today");
  const [other, setOther] = useState(today);
  const [product, setProduct] = useState(info.product ?? "");
  const [next, setNext] = useState(info.suggestedNext);
  const [nextTouched, setNextTouched] = useState(false);
  const [remind, setRemind] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const date =
    when === "today"
      ? today
      : when === "yesterday"
        ? addDaysISO(today, -1)
        : other || today;

  function pick(w: When, d: string) {
    setWhen(w);
    if (!nextTouched) setNext(addMonthsISO(d, info.intervalMonths));
  }

  function save() {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const res = await safely(() =>
        completeTreatment({
          occurrenceId,
          on: date,
          product: product.trim() || undefined,
          nextDueOn: next || undefined,
          remind,
        }),
      );
      if (!res.ok) {
        setErrors(res.errors ?? {});
        setError(res.message);
        return;
      }
      onOpenChange(false);
    });
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={`Confirmar ${info.title.toLowerCase()}`}
    >
      <div className="flex items-center gap-3">
        <PetAvatar
          name={pet.name}
          color={pet.color}
          photoUrl={pet.photoUrl}
          species={pet.species}
          petId={pet.id}
          ring={false}
          className="size-14 text-[20px]"
        />
        <div className="min-w-0">
          <p
            className={cn(
              "text-etiqueta font-extrabold",
              colorStyles[pet.color].text,
            )}
          >
            {pet.name}
          </p>
          <p className="text-seccao">{info.title}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-etiqueta">Quando foi?</span>
        <div className="flex flex-wrap gap-2">
          <Chip
            selected={when === "today"}
            onClick={() => pick("today", today)}
          >
            Hoje
          </Chip>
          <Chip
            selected={when === "yesterday"}
            onClick={() => pick("yesterday", addDaysISO(today, -1))}
          >
            Ontem
          </Chip>
          <Chip
            selected={when === "other"}
            onClick={() => pick("other", other)}
          >
            Outro dia
          </Chip>
        </div>
        {when === "other" ? (
          <TextField
            id="feito-dia"
            label="Dia"
            type="date"
            max={today}
            value={other}
            onChange={(e) => {
              const v = e.target.value || today;
              setOther(v);
              if (!nextTouched) setNext(addMonthsISO(v, info.intervalMonths));
            }}
          />
        ) : null}
      </div>

      <TextField
        id="feito-produto"
        label="Produto"
        value={product}
        maxLength={80}
        autoComplete="off"
        autoCapitalize="sentences"
        onChange={(e) => setProduct(e.target.value)}
        help={info.product ? "O mesmo da última vez" : undefined}
        error={errors.product}
      />

      <div className="flex flex-col gap-3">
        <TextField
          id="feito-proxima"
          label="Próxima"
          type="date"
          min={date}
          value={next}
          onChange={(e) => {
            setNext(e.target.value);
            setNextTouched(true);
          }}
          error={errors.nextDueOn}
          help={
            next
              ? `Sugestão: daqui a ${info.intervalMonths} ${info.intervalMonths === 1 ? "mês" : "meses"} (${formatISODate(next)})`
              : undefined
          }
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-etiqueta">Lembrar-me</span>
          <Switch checked={remind} onChange={setRemind} label="Lembrar-me" />
        </div>
      </div>

      {error ? <ErrorBanner>{error}</ErrorBanner> : null}
      <Button
        type="button"
        size="feito"
        disabled={pending}
        onClick={save}
        className="bg-feito text-branco hover:bg-feito/90"
      >
        Marcar como feito
      </Button>
    </Sheet>
  );
}
