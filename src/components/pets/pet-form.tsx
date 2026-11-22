"use client";

import { Cat, ChevronDown, Dog, Check } from "lucide-react";
import { useActionState, useState } from "react";

import { ErrorBanner, FieldError } from "@/components/auth/banner";
import { TextField } from "@/components/auth/text-field";
import { Button } from "@/components/ui/button";
import { createPet, updatePet, type PetFormState } from "@/lib/pets/actions";
import { monthYear, approxBirthDate } from "@/lib/pets/age";
import {
  PET_COLORS,
  breedSuggestions,
  colorStyles,
  type PetColor,
  type Species,
} from "@/lib/pets/constants";
import { cn } from "@/lib/utils";

import { PhotoPicker } from "./photo-picker";

export type PetFormValues = {
  name: string;
  species: Species | "";
  birthMode: "exact" | "approx";
  birthDate: string;
  approxValue: string;
  approxUnit: "months" | "years";
  breed: string;
  sex: "female" | "male" | "";
  neutered: "yes" | "no" | "";
  microchip: string;
  color: PetColor;
  notes: string;
};

const initialState: PetFormState = {};

const chipBase =
  "focus-visible:shadow-foco flex h-chip items-center justify-center rounded-capsula px-4 text-etiqueta font-bold outline-none";

function Segmented<T extends string>({
  legend,
  name,
  value,
  options,
  onChange,
}: {
  legend: string;
  name: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-etiqueta">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label key={o.value} className="cursor-pointer">
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="peer sr-only"
            />
            <span
              className={cn(
                chipBase,
                "peer-focus-visible:shadow-foco bg-linha-suave text-tinta peer-checked:bg-pinheiro peer-checked:text-branco",
              )}
            >
              {o.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Ecrã 12 — novo animal e editar. Só o essencial à vista; o resto em «Mais detalhes». */
export function PetForm({
  petId,
  initial,
  photoUrl,
}: {
  /** Presente ao editar. */
  petId?: string;
  initial: PetFormValues;
  photoUrl: string | null;
}) {
  const [state, formAction, pending] = useActionState<PetFormState, FormData>(
    petId ? updatePet.bind(null, petId) : createPet,
    initialState,
  );
  const [v, setV] = useState<PetFormValues>(initial);
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [removed, setRemoved] = useState(false);
  const dropPhoto = () => {
    if (photo) URL.revokeObjectURL(photo.url);
    setPhoto(null);
  };
  const set = <K extends keyof PetFormValues>(k: K, val: PetFormValues[K]) =>
    setV((p) => ({ ...p, [k]: val }));

  const errors = state.errors ?? {};
  const hasDetails = !!(
    initial.breed ||
    initial.sex ||
    initial.neutered ||
    initial.microchip ||
    initial.notes
  );
  const approxNumber = Number(v.approxValue);
  const approxHint =
    v.birthMode === "approx" &&
    v.approxValue !== "" &&
    Number.isInteger(approxNumber) &&
    approxNumber >= 0 &&
    approxNumber <= (v.approxUnit === "years" ? 40 : 480)
      ? `≈ ${monthYear(approxBirthDate(approxNumber, v.approxUnit))}`
      : null;
  const species = v.species || "dog";

  return (
    <form
      noValidate
      className="flex flex-col gap-5"
      action={(formData) => {
        if (photo) formData.set("photo", photo.blob, "foto.jpg");
        if (removed && !photo) formData.set("remove_photo", "1");
        formAction(formData);
      }}
    >
      {state.message ? <ErrorBanner>{state.message}</ErrorBanner> : null}

      <PhotoPicker
        currentUrl={photoUrl}
        blob={photo?.blob ?? null}
        previewUrl={photo?.url ?? null}
        removed={removed}
        error={errors.photo}
        onChange={(blob, url) => {
          dropPhoto();
          setPhoto({ blob, url });
          setRemoved(false);
        }}
        onRemove={() => {
          dropPhoto();
          setRemoved(true);
        }}
      />

      <TextField
        id="name"
        name="name"
        label="Nome"
        autoComplete="off"
        autoCapitalize="words"
        className="text-[20px]"
        value={v.name}
        onChange={(e) => set("name", e.target.value)}
        error={errors.name}
        required
      />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-etiqueta">É um…</legend>
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              { value: "dog", label: "Cão", Icon: Dog },
              { value: "cat", label: "Gato", Icon: Cat },
            ] as const
          ).map(({ value, label, Icon }) => (
            <label key={value} className="cursor-pointer">
              <input
                type="radio"
                name="species"
                value={value}
                checked={v.species === value}
                onChange={() => set("species", value)}
                className="peer sr-only"
              />
              <span className="peer-focus-visible:shadow-foco flex h-24 flex-col items-center justify-center gap-1 rounded-cartao border-2 border-linha bg-branco text-[17px] font-extrabold text-tinta peer-checked:border-pinheiro peer-checked:bg-menta peer-checked:shadow-[inset_0_0_0_1px_var(--color-pinheiro)]">
                <Icon className="size-9" strokeWidth={2.2} aria-hidden />
                {label}
              </span>
            </label>
          ))}
        </div>
        {errors.species ? (
          <FieldError id="species-erro">{errors.species}</FieldError>
        ) : null}
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-etiqueta">Nascimento</legend>
        <input type="hidden" name="birth_mode" value={v.birthMode} />
        <div
          role="radiogroup"
          aria-label="Como queres indicar o nascimento"
          className="grid grid-cols-2 gap-1 rounded-capsula bg-linha-suave p-1"
        >
          {(
            [
              { value: "exact", label: "Data exata" },
              { value: "approx", label: "Idade aproximada" },
            ] as const
          ).map((o) => (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={v.birthMode === o.value}
              onClick={() => set("birthMode", o.value)}
              className={cn(
                "focus-visible:shadow-foco h-[42px] rounded-capsula text-etiqueta font-bold outline-none",
                v.birthMode === o.value
                  ? "shadow-segmento bg-branco text-tinta"
                  : "text-tinta-suave",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>

        {v.birthMode === "exact" ? (
          <TextField
            id="birth_date"
            name="birth_date"
            type="date"
            label="Data de nascimento"
            max={new Date().toISOString().slice(0, 10)}
            value={v.birthDate}
            onChange={(e) => set("birthDate", e.target.value)}
            error={errors.birth_date}
            help="Podes deixar em branco se não souberes."
          />
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex gap-3">
              <TextField
                id="approx_value"
                name="approx_value"
                label="Idade"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="3"
                className="w-28 text-[24px] font-extrabold"
                value={v.approxValue}
                onChange={(e) => set("approxValue", e.target.value)}
                error={errors.approx_value}
              />
              <div className="flex flex-1 flex-col gap-2">
                <span className="text-etiqueta" id="unit-label">
                  Em
                </span>
                <div
                  role="radiogroup"
                  aria-labelledby="unit-label"
                  className="grid h-campo grid-cols-2 gap-1 rounded-capsula bg-linha-suave p-1"
                >
                  {(
                    [
                      { value: "years", label: "anos" },
                      { value: "months", label: "meses" },
                    ] as const
                  ).map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      role="radio"
                      aria-checked={v.approxUnit === o.value}
                      onClick={() => set("approxUnit", o.value)}
                      className={cn(
                        "focus-visible:shadow-foco rounded-capsula text-etiqueta font-bold outline-none",
                        v.approxUnit === o.value
                          ? "shadow-segmento bg-branco text-tinta"
                          : "text-tinta-suave",
                      )}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
                <input type="hidden" name="approx_unit" value={v.approxUnit} />
              </div>
            </div>
            {approxHint ? (
              <p className="text-legenda text-tinta-suave">{approxHint}</p>
            ) : null}
          </div>
        )}
      </fieldset>

      <details
        open={hasDetails}
        className="group rounded-cartao border-[1.5px] border-linha bg-branco"
      >
        <summary className="focus-visible:shadow-foco flex min-h-16 cursor-pointer list-none items-center gap-3 rounded-cartao p-4 outline-none [&::-webkit-details-marker]:hidden">
          <span className="flex-1">
            <span className="block text-seccao">Mais detalhes</span>
            <span className="block text-legenda text-tinta-suave">
              Raça, sexo, esterilizado, chip, cor, notas
            </span>
          </span>
          <ChevronDown
            className="size-6 text-tinta-suave transition-transform group-open:rotate-180"
            strokeWidth={2.2}
            aria-hidden
          />
        </summary>

        <div className="flex flex-col gap-5 px-4 pb-5">
          <div>
            <TextField
              id="breed"
              name="breed"
              label="Raça"
              list="breeds"
              autoComplete="off"
              value={v.breed}
              onChange={(e) => set("breed", e.target.value)}
              error={errors.breed}
            />
            <datalist id="breeds">
              {breedSuggestions[species].map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </div>

          <Segmented
            legend="Sexo"
            name="sex"
            value={v.sex}
            onChange={(x) => set("sex", v.sex === x ? "" : x)}
            options={[
              { value: "female", label: "Fêmea" },
              { value: "male", label: "Macho" },
            ]}
          />

          <Segmented
            legend="Esterilizado"
            name="neutered"
            value={v.neutered}
            onChange={(x) => set("neutered", v.neutered === x ? "" : x)}
            options={[
              { value: "yes", label: "Sim" },
              { value: "no", label: "Não" },
            ]}
          />

          <TextField
            id="microchip"
            name="microchip"
            label="N.º do chip"
            inputMode="numeric"
            autoComplete="off"
            value={v.microchip}
            onChange={(e) => set("microchip", e.target.value)}
            error={errors.microchip}
          />

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-etiqueta">Cor de identificação</legend>
            <div className="flex flex-wrap gap-3">
              {PET_COLORS.map((c) => (
                <label key={c} className="cursor-pointer">
                  <input
                    type="radio"
                    name="color"
                    value={c}
                    checked={v.color === c}
                    onChange={() => set("color", c)}
                    className="peer sr-only"
                  />
                  <span
                    className={cn(
                      "peer-focus-visible:shadow-foco flex size-11 items-center justify-center rounded-full text-branco ring-offset-2 peer-checked:ring-2",
                      colorStyles[c].bg,
                      colorStyles[c].ring,
                    )}
                  >
                    <span className="sr-only">{colorStyles[c].label}</span>
                    {v.color === c ? (
                      <Check className="size-5" strokeWidth={3} aria-hidden />
                    ) : null}
                  </span>
                </label>
              ))}
            </div>
            <p className="text-legenda text-tinta-suave">
              {colorStyles[v.color].label}
            </p>
          </fieldset>

          <div className="flex flex-col gap-2">
            <label htmlFor="notes" className="text-etiqueta">
              Notas
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              value={v.notes}
              onChange={(e) => set("notes", e.target.value)}
              aria-invalid={errors.notes ? true : undefined}
              className="focus:shadow-foco w-full rounded-campo border-2 border-linha bg-branco px-4 py-3 text-corpo font-semibold outline-none focus:border-pinheiro aria-invalid:border-atraso"
            />
            {errors.notes ? (
              <FieldError id="notes-erro">{errors.notes}</FieldError>
            ) : null}
          </div>
        </div>
      </details>

      <Button type="submit" disabled={pending}>
        {pending ? "A guardar…" : "Guardar"}
      </Button>
    </form>
  );
}
