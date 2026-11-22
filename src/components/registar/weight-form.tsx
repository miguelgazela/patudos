"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { ErrorBanner } from "@/components/auth/banner";
import { TextField } from "@/components/auth/text-field";
import { PetPicker } from "@/components/consulta/ui";
import { Button } from "@/components/ui/button";
import { formatISODate } from "@/lib/dates";
import { formatKg } from "@/lib/units";
import { saveWeight } from "@/lib/vet-visits/actions";
import type { FormPet } from "@/lib/vet-visits/data";
import { buildWeightPayload } from "@/lib/vet-visits/quick";

import { QuickSaved } from "./saved";

type Done = { petId: string; petName: string; kg: number };

/** Ecrã 17 — Registar peso: animal, kg e data (hoje). */
export function WeightForm({
  pets,
  initialPetId,
  today,
}: {
  pets: FormPet[];
  initialPetId: string;
  today: string;
}) {
  const router = useRouter();
  const [petId, setPetId] = useState(initialPetId);
  const [date, setDate] = useState(today);
  const [kg, setKg] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  /** Pesos gravados nesta sessão: a referência «Último» acompanha-os sem recarregar. */
  const [saved, setSaved] = useState<
    Record<string, { kg: number; on: string }>
  >({});
  const [pending, startTransition] = useTransition();

  const pet = pets.find((p) => p.id === petId) ?? pets[0]!;
  const last = saved[pet.id] ?? pet.lastWeight;

  function onSubmit() {
    if (pending) return;
    const { payload, errors: errs } = buildWeightPayload({ petId, date, kg });
    setErrors(errs);
    if (!payload) {
      setServerError("Confirma os campos assinalados.");
      return;
    }
    setServerError(null);
    startTransition(async () => {
      const res = await saveWeight(payload);
      if (!res.ok) {
        setErrors(res.errors ?? {});
        setServerError(res.message);
        return;
      }
      const on = payload.measured_on ?? today;
      setSaved((s) => {
        const prev = s[petId] ?? pet.lastWeight;
        return !prev || on >= prev.on
          ? { ...s, [petId]: { kg: payload.weight_kg, on } }
          : s;
      });
      setDone({ petId, petName: pet.name, kg: payload.weight_kg });
      window.scrollTo({ top: 0 });
    });
  }

  if (done) {
    return (
      <QuickSaved
        testId="weight-saved"
        title="Peso guardado"
        detail={`${done.petName} pesa ${formatKg(done.kg)}.`}
        petId={done.petId}
        onAnother={() => {
          setDone(null);
          setKg("");
          setDate(today);
          setErrors({});
        }}
      />
    );
  }

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
          Registar peso
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

        <PetPicker
          pets={pets}
          value={petId}
          onChange={(id) => {
            setPetId(id);
            setErrors({});
          }}
        />

        <div className="flex flex-col gap-2">
          <label htmlFor="weight" className="text-etiqueta">
            Peso
          </label>
          <div className="relative">
            <input
              id="weight"
              name="weight_kg"
              inputMode="decimal"
              autoComplete="off"
              autoFocus
              placeholder={last ? String(last.kg).replace(".", ",") : "12,4"}
              value={kg}
              onChange={(e) => setKg(e.target.value)}
              aria-invalid={errors.weight_kg ? true : undefined}
              className="focus:shadow-foco h-[76px] w-full rounded-campo border-2 border-linha bg-branco pr-16 pl-4 text-[36px] font-extrabold outline-none placeholder:text-placeholder focus:border-pinheiro aria-invalid:border-atraso aria-invalid:bg-atraso-campo"
            />
            <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-[22px] font-bold text-tinta-suave">
              kg
            </span>
          </div>
          {errors.weight_kg ? (
            <p className="text-etiqueta text-atraso" role="alert">
              {errors.weight_kg}
            </p>
          ) : last ? (
            <p
              className="text-[13px] font-semibold text-tinta-suave"
              data-testid="last-weight"
            >
              Último: {formatKg(last.kg)} · {formatISODate(last.on)}
            </p>
          ) : null}
        </div>

        <TextField
          id="measured_on"
          name="measured_on"
          type="date"
          label={date === today ? "Data · hoje" : "Data"}
          max={today}
          value={date}
          onChange={(e) => setDate(e.target.value || today)}
          error={errors.measured_on}
        />

        <div className="fixed inset-x-0 bottom-0 z-40 border-t-[1.5px] border-linha bg-branco">
          <div className="mx-auto flex w-full max-w-md flex-col gap-2 px-5 pt-3 pb-[max(env(safe-area-inset-bottom),12px)]">
            <Button type="submit" disabled={pending}>
              {pending ? "A guardar…" : "Guardar"}
            </Button>
          </div>
        </div>
      </form>
    </>
  );
}
