"use client";

import { failMessage } from "@/lib/client-action";
import { Camera, FileText, Image as ImageIcon, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { ErrorBanner } from "@/components/auth/banner";
import { TextField } from "@/components/auth/text-field";
import { PetPicker } from "@/components/consulta/ui";
import { QuickSaved } from "@/components/registar/saved";
import { useResetOnLeave } from "@/components/registar/use-reset-on-leave";
import { Button } from "@/components/ui/button";
import { createDocument } from "@/lib/documentos/actions";
import {
  checkDocumentFile,
  DOCUMENT_CHIPS,
  DOCUMENT_IMAGE_SIDE,
  HEIC_ERROR,
  IMAGE_ERROR,
  isHeic,
  suggestTitle,
  type DocumentKind,
} from "@/lib/documentos/logic";
import { resizeToJpeg } from "@/lib/pets/resize-image";
import { createClient } from "@/lib/supabase/client";
import type { FormPet } from "@/lib/vet-visits/data";

type Picked = {
  file: File;
  isPdf: boolean;
  label: string;
  previewUrl: string | null;
};

function sizeLabel(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} kB`;
}

/** Ecrã 27 — Adicionar documento: ficheiro, tipo, título sugerido, animal e data. */
export function DocumentForm({
  pets,
  sexes,
  initialPetId,
  today,
}: {
  pets: FormPet[];
  sexes: Record<string, "female" | "male" | null>;
  initialPetId: string;
  today: string;
}) {
  const router = useRouter();
  const [petId, setPetId] = useState(initialPetId);
  const [kind, setKind] = useState<DocumentKind>("other");
  /** `null` = ainda a seguir a sugestão. */
  const [titleInput, setTitleInput] = useState<string | null>(null);
  const [date, setDate] = useState(today);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState<{ petId: string; title: string } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const pdf = useRef<HTMLInputElement>(null);
  const previewRef = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    },
    [],
  );

  const pet = pets.find((p) => p.id === petId) ?? pets[0]!;
  const suggested = suggestTitle(kind, pet.name, sexes[pet.id] ?? null);
  const title = titleInput ?? suggested;

  function setPick(next: Picked | null) {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = next?.previewUrl ?? null;
    setPicked(next);
  }

  async function onPick(file: File | undefined) {
    if (!file) return;
    setFileError(null);
    const check = checkDocumentFile(file);
    if (!check.ok) {
      setFileError(check.message);
      return;
    }
    if (check.kind === "pdf") {
      setPick({ file, isPdf: true, label: file.name, previewUrl: null });
      return;
    }
    setProcessing(true);
    try {
      const jpeg = await resizeToJpeg(file, DOCUMENT_IMAGE_SIDE);
      const out = new File([jpeg], "documento.jpg", { type: "image/jpeg" });
      setPick({
        file: out,
        isPdf: false,
        label: "Foto",
        previewUrl: URL.createObjectURL(out),
      });
    } catch {
      // O Safari abre HEIC; outros browsers não conseguem decodificá-lo.
      setFileError(isHeic(file) ? HEIC_ERROR : IMAGE_ERROR);
    } finally {
      setProcessing(false);
    }
  }

  function onSubmit() {
    if (pending || processing) return;
    if (!picked) {
      setFileError("Escolhe uma foto ou um PDF.");
      return;
    }
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setErrors({ title: "Escreve um título." });
      return;
    }
    setErrors({});
    setServerError(null);
    startTransition(async () => {
      const supabase = createClient();
      const path = `${petId}/${crypto.randomUUID()}.${picked.isPdf ? "pdf" : "jpg"}`;
      const up = await supabase.storage
        .from("documentos")
        .upload(path, picked.file, {
          contentType: picked.file.type,
          cacheControl: "3600",
        });
      if (up.error) {
        setServerError(
          failMessage(
            "Não conseguimos enviar o ficheiro. Verifica a ligação e tenta de novo.",
          ),
        );
        return;
      }
      try {
        const res = await createDocument({
          petId,
          kind,
          title: cleanTitle,
          date: date || today,
          storagePath: path,
          mimeType: picked.file.type,
        });
        if (!res.ok) {
          // A ação já apaga o ficheiro quando a gravação falha; isto cobre o resto.
          await supabase.storage.from("documentos").remove([path]);
          setErrors(res.errors ?? {});
          setServerError(res.message);
          return;
        }
        setDone({ petId, title: cleanTitle });
        window.scrollTo({ top: 0 });
      } catch {
        await supabase.storage.from("documentos").remove([path]);
        setServerError(failMessage());
      }
    });
  }

  const startAnother = () => {
    setDone(null);
    setPick(null);
    setTitleInput(null);
    setKind("other");
    setDate(today);
    setErrors({});
  };
  useResetOnLeave(startAnother);

  if (done) {
    return (
      <QuickSaved
        testId="document-saved"
        title="Documento guardado"
        detail={`«${done.title}» já está nos documentos.`}
        petId={done.petId}
        doneHref={`/animais/${done.petId}/documentos`}
        onAnother={startAnother}
      />
    );
  }

  const sourceCls =
    "focus-visible:shadow-foco flex h-[84px] flex-col items-center justify-center gap-1.5 rounded-cartao border-2 border-linha bg-branco text-[14px] font-extrabold text-tinta outline-none active:translate-y-px disabled:opacity-60";

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
          Adicionar documento
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

        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-3 gap-2.5">
            <button
              type="button"
              className={sourceCls}
              disabled={processing}
              onClick={() => camera.current?.click()}
            >
              <Camera
                className="size-6 text-pinheiro"
                strokeWidth={2.2}
                aria-hidden
              />
              Tirar foto
            </button>
            <button
              type="button"
              className={sourceCls}
              disabled={processing}
              onClick={() => gallery.current?.click()}
            >
              <ImageIcon
                className="size-6 text-pinheiro"
                strokeWidth={2.2}
                aria-hidden
              />
              Galeria
            </button>
            <button
              type="button"
              className={sourceCls}
              disabled={processing}
              onClick={() => pdf.current?.click()}
            >
              <FileText
                className="size-6 text-pinheiro"
                strokeWidth={2.2}
                aria-hidden
              />
              Ficheiro PDF
            </button>
          </div>
          {(
            [
              [camera, "camera", "image/*", "environment", "Tirar foto"],
              [gallery, "gallery", "image/*", undefined, "Escolher foto"],
              [pdf, "pdf", "application/pdf", undefined, "Escolher PDF"],
            ] as const
          ).map(([ref, id, accept, capture, label]) => (
            <input
              key={id}
              ref={ref}
              type="file"
              aria-label={label}
              accept={accept}
              capture={capture}
              data-testid={`file-${id}`}
              className="sr-only"
              tabIndex={-1}
              onChange={(e) => {
                void onPick(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          ))}
          {processing ? (
            <p className="text-legenda text-tinta-suave" role="status">
              A preparar a foto…
            </p>
          ) : null}
          {fileError ? (
            <p className="text-etiqueta text-atraso" role="alert">
              {fileError}
            </p>
          ) : null}
        </div>

        {picked ? (
          <div
            className="flex items-center gap-3 rounded-cartao border-[1.5px] border-linha bg-branco p-2.5"
            data-testid="preview"
          >
            <span className="flex h-[84px] w-16 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border-[1.5px] border-linha bg-nevoa text-tinta-suave">
              {picked.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={picked.previewUrl}
                  alt="Pré-visualização"
                  className="size-full object-cover"
                />
              ) : (
                <FileText className="size-8" strokeWidth={2.2} aria-hidden />
              )}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-corpo font-bold">
                {picked.isPdf ? picked.label : "Foto pronta"}
              </span>
              <span className="text-legenda text-tinta-suave">
                {picked.isPdf ? "PDF" : "Foto"} · {sizeLabel(picked.file.size)}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setPick(null)}
              className="focus-visible:shadow-foco h-11 px-3 text-etiqueta font-extrabold text-atraso outline-none"
            >
              Remover
            </button>
          </div>
        ) : null}

        <PetPicker
          pets={pets}
          value={petId}
          onChange={(id) => {
            setPetId(id);
            setErrors({});
          }}
        />

        <div className="flex flex-col gap-2">
          <span id="tipo-label" className="text-etiqueta">
            Tipo
          </span>
          <div
            role="radiogroup"
            aria-labelledby="tipo-label"
            className="flex flex-wrap gap-2"
          >
            {DOCUMENT_CHIPS.map((c) => (
              <button
                key={c.kind}
                type="button"
                role="radio"
                aria-checked={kind === c.kind}
                onClick={() => setKind(c.kind)}
                className={
                  "focus-visible:shadow-foco flex h-chip items-center justify-center rounded-capsula px-4 text-etiqueta font-bold outline-none " +
                  (kind === c.kind
                    ? "bg-pinheiro text-branco"
                    : "bg-linha-suave text-tinta")
                }
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <TextField
          id="title"
          name="title"
          label="Título"
          value={title}
          maxLength={120}
          autoComplete="off"
          autoCapitalize="sentences"
          onChange={(e) => setTitleInput(e.target.value)}
          error={errors.title}
        />

        <TextField
          id="document_date"
          name="document_date"
          type="date"
          label={date === today ? "Data · hoje" : "Data"}
          value={date}
          onChange={(e) => setDate(e.target.value || today)}
          error={errors.date}
        />

        <div className="fixed inset-x-0 bottom-0 z-40 border-t-[1.5px] border-linha bg-branco">
          <div className="mx-auto flex w-full max-w-md flex-col gap-2 px-5 pt-3 pb-[max(env(safe-area-inset-bottom),12px)]">
            <Button type="submit" disabled={pending || processing}>
              {pending ? "A guardar…" : "Guardar"}
            </Button>
          </div>
        </div>
      </form>
    </>
  );
}
