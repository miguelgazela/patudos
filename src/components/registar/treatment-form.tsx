"use client";

import { ChevronDown, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { ErrorBanner } from "@/components/auth/banner";
import { TextField } from "@/components/auth/text-field";
import { PetPicker } from "@/components/consulta/ui";
import { TreatmentBody } from "@/components/consulta/treatment-sheet";
import { formatISODate } from "@/lib/dates";
import { formatCents, parseEuroToCents } from "@/lib/units";
import { saveHomeTreatment } from "@/lib/vet-visits/actions";
import type { FormPet, FormPreset } from "@/lib/vet-visits/data";
import type { TreatmentItem } from "@/lib/vet-visits/draft";
import { effectiveNextDue } from "@/lib/vet-visits/payload";
import { buildTreatmentPayload } from "@/lib/vet-visits/quick";

import { QuickSaved } from "./saved";

type Done = { petId: string; petName: string; title: string; next: string };

/** Ecrã 16 — Registar tratamento (vacina ou desparasitação em casa). */
export function TreatmentForm({
  pets,
  presets,
  products,
  initialPetId,
  today,
}: {
  pets: FormPet[];
  presets: FormPreset[];
  products: string[];
  initialPetId: string;
  today: string;
}) {
  const router = useRouter();
  const [petId, setPetId] = useState(initialPetId);
  const [date, setDate] = useState(today);
  const [cost, setCost] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  /** Remonta os campos do painel (limpa-os) a cada «Registar outro». */
  const [round, setRound] = useState(0);
  const [pending, startTransition] = useTransition();

  const pet = pets.find((p) => p.id === petId) ?? pets[0]!;

  function save(item: TreatmentItem) {
    if (pending) return;
    const { payload, errors: errs } = buildTreatmentPayload({
      petId,
      date,
      item,
      cost,
    });
    setErrors(errs);
    if (!payload) {
      setServerError("Confirma os campos assinalados.");
      return;
    }
    setServerError(null);
    startTransition(async () => {
      const res = await saveHomeTreatment(payload);
      if (!res.ok) {
        setErrors(res.errors ?? {});
        setServerError(res.message);
        return;
      }
      setDone({
        petId,
        petName: pet.name,
        title: item.title,
        next: payload.next_due_on ?? effectiveNextDue(item, date),
      });
      window.scrollTo({ top: 0 });
    });
  }

  if (done) {
    return (
      <QuickSaved
        testId="treatment-saved"
        title="Tratamento guardado"
        detail={`${done.title} de ${done.petName} ficou registado.${done.next ? ` Próxima: ${formatISODate(done.next)}.` : ""}`}
        petId={done.petId}
        onAnother={() => {
          setDone(null);
          setCost("");
          setErrors({});
          setDate(today);
          setRound((r) => r + 1);
        }}
      />
    );
  }

  const costError = errors["expense.amount_cents"];
  const cents = parseEuroToCents(cost);

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
          Registar tratamento
        </h1>
      </header>

      <div className="flex flex-col gap-5 pb-32">
        <PetPicker
          pets={pets}
          value={petId}
          onChange={(id) => {
            setPetId(id);
            setErrors({});
          }}
        />

        <TextField
          id="occurred_on"
          name="occurred_on"
          type="date"
          label={date === today ? "Data · hoje" : "Data"}
          max={today}
          value={date}
          onChange={(e) => setDate(e.target.value || today)}
          error={errors.occurred_on}
        />

        <TreatmentBody
          key={`${pet.id}-${round}`}
          initialTab="vaccine"
          species={pet.species}
          presets={presets}
          products={products}
          visitDate={date}
          onAdd={save}
          submitLabel="Guardar"
          fixedFooter
          pending={pending}
          banner={
            serverError ? <ErrorBanner>{serverError}</ErrorBanner> : undefined
          }
          extra={
            <details
              className="group rounded-cartao border-[1.5px] border-linha bg-branco"
              open={cost !== "" || undefined}
            >
              <summary className="focus-visible:shadow-foco flex min-h-16 cursor-pointer list-none items-center gap-3 rounded-cartao p-4 outline-none [&::-webkit-details-marker]:hidden">
                <span className="flex-1">
                  <span className="block text-seccao">Custo</span>
                  <span className="block text-legenda text-tinta-suave">
                    {cents
                      ? `${formatCents(cents)} · cria uma despesa`
                      : "Opcional · cria uma despesa"}
                  </span>
                </span>
                <ChevronDown
                  className="size-6 text-tinta-suave transition-transform group-open:rotate-180"
                  strokeWidth={2.2}
                  aria-hidden
                />
              </summary>
              <div className="flex flex-col gap-2 px-4 pb-5">
                <div className="relative">
                  <input
                    id="cost"
                    aria-label="Custo em euros"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="0,00"
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    aria-invalid={costError ? true : undefined}
                    className="focus:shadow-foco h-16 w-full rounded-campo border-2 border-linha bg-branco pr-14 pl-4 text-[28px] font-extrabold outline-none placeholder:text-placeholder focus:border-pinheiro aria-invalid:border-atraso aria-invalid:bg-atraso-campo"
                  />
                  <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-[22px] font-bold text-tinta-suave">
                    €
                  </span>
                </div>
                {costError ? (
                  <p className="text-etiqueta text-atraso" role="alert">
                    {costError}
                  </p>
                ) : null}
              </div>
            </details>
          }
        />
      </div>
    </>
  );
}
