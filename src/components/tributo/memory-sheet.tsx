"use client";

import { Camera } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";

import { ErrorBanner, FieldError } from "@/components/auth/banner";
import { Sheet } from "@/components/consulta/ui";
import { Button } from "@/components/ui/button";
import { failMessage } from "@/lib/client-action";
import { resizeToJpeg } from "@/lib/pets/resize-image";
import {
  addMemory,
  updateMemory,
  type TributeState,
} from "@/lib/pets/tribute-actions";
import { MEMORY_MAX } from "@/lib/pets/tribute";

/** Painel para deixar (ou editar) uma memória: texto e foto opcional. */
export function MemorySheet({
  open,
  onOpenChange,
  petId,
  name,
  edit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  petId: string;
  name: string;
  /** Presente ao editar. */
  edit?: { id: string; body: string; photoUrl: string | null };
}) {
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={edit ? "Editar memória" : `Uma memória de ${name}`}
    >
      {/* O formulário só existe com o painel aberto: ao reabrir começa vazio. */}
      {open ? (
        <MemoryForm
          petId={petId}
          edit={edit}
          onDone={() => onOpenChange(false)}
        />
      ) : null}
    </Sheet>
  );
}

function MemoryForm({
  petId,
  edit,
  onDone,
}: {
  petId: string;
  edit?: { id: string; body: string; photoUrl: string | null };
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState<TributeState, FormData>(
    async (prev, formData) => {
      try {
        return edit
          ? await updateMemory(edit.id, prev, formData)
          : await addMemory(petId, prev, formData);
      } catch {
        return { ...prev, message: failMessage() };
      }
    },
    {},
  );
  const [body, setBody] = useState(edit?.body ?? "");
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [removed, setRemoved] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  const shown = photo ? photo.url : removed ? null : (edit?.photoUrl ?? null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setPhotoError(null);
    try {
      const blob = await resizeToJpeg(file);
      if (photo) URL.revokeObjectURL(photo.url);
      setPhoto({ blob, url: URL.createObjectURL(blob) });
      setRemoved(false);
    } catch {
      setPhotoError("Não conseguimos usar essa foto. Tenta outra.");
    }
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      action={(formData) => {
        if (photo) formData.set("photo", photo.blob, "foto.jpg");
        if (removed && !photo) formData.set("remove_photo", "1");
        action(formData);
      }}
    >
      {state.message ? <ErrorBanner>{state.message}</ErrorBanner> : null}

      <div className="flex flex-col gap-2">
        <label htmlFor="body" className="text-etiqueta">
          A tua memória
        </label>
        <textarea
          id="body"
          name="body"
          rows={5}
          maxLength={MEMORY_MAX}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          aria-invalid={state.errors?.body ? true : undefined}
          aria-describedby="body-ajuda"
          className="focus:shadow-foco w-full rounded-campo border-2 border-linha bg-branco px-4 py-3 text-corpo font-semibold outline-none focus:border-pinheiro aria-invalid:border-atraso"
        />
        {state.errors?.body ? (
          <FieldError id="body-erro">{state.errors.body}</FieldError>
        ) : null}
        <p id="body-ajuda" className="text-legenda text-tinta-suave">
          {body.length} de {MEMORY_MAX} letras
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={shown}
            alt=""
            className="max-h-56 w-full rounded-cartao object-cover"
          />
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="auto"
            className="h-12"
            onClick={() => inputRef.current?.click()}
          >
            <Camera aria-hidden strokeWidth={2.2} />
            {shown ? "Mudar foto" : "Juntar foto"}
          </Button>
          {shown ? (
            <Button
              type="button"
              variant="link"
              size="auto"
              onClick={() => {
                if (photo) URL.revokeObjectURL(photo.url);
                setPhoto(null);
                setRemoved(true);
              }}
            >
              Tirar foto
            </Button>
          ) : null}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          data-testid="memory-photo-input"
          onChange={(e) => {
            void pick(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        {photoError || state.errors?.photo ? (
          <p role="alert" className="text-etiqueta text-atraso">
            {photoError ?? state.errors?.photo}
          </p>
        ) : null}
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "A guardar…" : "Guardar"}
      </Button>
    </form>
  );
}
