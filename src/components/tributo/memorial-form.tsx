"use client";

import { Cat, Dog } from "lucide-react";
import { useActionState, useState } from "react";

import { ErrorBanner, FieldError } from "@/components/auth/banner";
import { TextField } from "@/components/auth/text-field";
import { PhotoPicker } from "@/components/pets/photo-picker";
import { Button } from "@/components/ui/button";
import { failMessage } from "@/lib/client-action";
import {
  createMemorialPet,
  type TributeState,
} from "@/lib/pets/tribute-actions";

import { PartialDateField } from "./partial-date-field";
import { TributeTextField } from "./tribute-fields";

/** «Em memória de…»: um animal que já faleceu, com o essencial. */
export function MemorialForm() {
  const [state, action, pending] = useActionState<TributeState, FormData>(
    async (prev, formData) => {
      try {
        return await createMemorialPet(prev, formData);
      } catch {
        return { ...prev, message: failMessage() };
      }
    },
    {},
  );
  const [species, setSpecies] = useState<"dog" | "cat" | "">("");
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const errors = state.errors ?? {};

  return (
    <form
      noValidate
      className="flex flex-col gap-5"
      action={(formData) => {
        if (photo) formData.set("photo", photo.blob, "foto.jpg");
        action(formData);
      }}
    >
      {state.message ? <ErrorBanner>{state.message}</ErrorBanner> : null}

      <PhotoPicker
        currentUrl={null}
        blob={photo?.blob ?? null}
        previewUrl={photo?.url ?? null}
        removed={false}
        error={errors.photo}
        onChange={(blob, url) => {
          if (photo) URL.revokeObjectURL(photo.url);
          setPhoto({ blob, url });
        }}
        onRemove={() => {
          if (photo) URL.revokeObjectURL(photo.url);
          setPhoto(null);
        }}
      />

      <TextField
        id="name"
        name="name"
        label="Nome"
        autoComplete="off"
        autoCapitalize="words"
        className="text-[20px]"
        error={errors.name}
        required
      />

      <input type="hidden" name="species" value={species} />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-etiqueta">Era um…</legend>
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
                value={value}
                checked={species === value}
                onChange={() => setSpecies(value)}
                className="peer sr-only"
              />
              <span className="peer-focus-visible:shadow-foco flex h-24 flex-col items-center justify-center gap-1 rounded-cartao border-2 border-linha bg-branco text-[17px] font-extrabold text-tinta peer-checked:border-pinheiro peer-checked:bg-menta">
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

      <PartialDateField
        name="deceased_on"
        legend="Quando faleceu"
        defaultPrecision="month"
        error={errors.deceased_on}
        help="Se não souberes o dia, escolhe Mês ou Ano."
        required
      />

      <details className="group rounded-cartao border-[1.5px] border-linha bg-branco">
        <summary className="focus-visible:shadow-foco flex min-h-16 cursor-pointer list-none items-center rounded-cartao p-4 outline-none [&::-webkit-details-marker]:hidden">
          <span className="flex-1">
            <span className="block text-seccao">Mais detalhes</span>
            <span className="block text-legenda text-tinta-suave">
              Nascimento
            </span>
          </span>
        </summary>
        <div className="px-4 pb-5">
          <PartialDateField
            name="birth_on"
            legend="Quando nasceu"
            defaultPrecision="year"
            error={errors.birth_on}
            help="Podes deixar em branco se não souberes."
          />
        </div>
      </details>

      <TributeTextField error={errors.tribute_text} />

      <Button type="submit" disabled={pending}>
        {pending ? "A guardar…" : "Guardar"}
      </Button>
    </form>
  );
}
