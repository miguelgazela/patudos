"use client";

import { Camera } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { resizeToJpeg } from "@/lib/pets/resize-image";

/**
 * Escolher foto (câmara ou galeria — o iPhone pergunta). Reduz para 1024 px em JPEG
 * antes do envio; o ficheiro fica em `onChange` e o formulário junta-o ao enviar.
 */
export function PhotoPicker({
  currentUrl,
  blob,
  previewUrl,
  removed,
  error,
  onChange,
  onRemove,
}: {
  currentUrl: string | null;
  blob: Blob | null;
  previewUrl: string | null;
  removed: boolean;
  error?: string;
  onChange: (blob: Blob, previewUrl: string) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const shown = blob ? previewUrl : removed ? null : currentUrl;

  async function onPick(file: File | undefined) {
    if (!file) return;
    setLocalError(null);
    try {
      const resized = await resizeToJpeg(file);
      onChange(resized, URL.createObjectURL(resized));
    } catch {
      setLocalError("Não conseguimos usar essa foto. Tenta outra.");
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        aria-label={shown ? "Mudar foto" : "Pôr foto"}
        className="focus-visible:shadow-foco flex size-30 flex-col items-center justify-center gap-1.5 overflow-hidden rounded-full border-2 border-dashed border-tracejado bg-branco text-etiqueta font-extrabold text-pinheiro outline-none data-[has-photo=true]:border-solid data-[has-photo=true]:border-linha"
        data-has-photo={shown ? "true" : "false"}
      >
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt="" className="size-full object-cover" />
        ) : (
          <>
            <Camera className="size-8" strokeWidth={2.2} aria-hidden />
            Pôr foto
          </>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        data-testid="photo-input"
        aria-label="Escolher foto do animal"
        onChange={(e) => {
          void onPick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {shown ? (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="link"
            size="auto"
            onClick={() => inputRef.current?.click()}
          >
            Mudar
          </Button>
          <Button type="button" variant="link" size="auto" onClick={onRemove}>
            Tirar foto
          </Button>
        </div>
      ) : null}
      {localError || error ? (
        <p role="alert" className="text-etiqueta text-atraso">
          {localError ?? error}
        </p>
      ) : null}
    </div>
  );
}
