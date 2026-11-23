"use client";

import { Download, FileText, Share2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

type State =
  { kind: "loading" } | { kind: "ready"; file: File } | { kind: "error" };

/**
 * «Partilhar» (usar com `key={src}`: ao mudar as opções, volta a preparar): prepara o PDF logo que as opções mudam (a folha de partilha do
 * iPhone só abre num toque «fresco», sem esperas pelo meio) e depois partilha o
 * ficheiro com a Web Share API; sem suporte, descarrega-o.
 */
export function PdfShare({
  src,
  fileName,
  title,
}: {
  src: string;
  fileName: string;
  title: string;
}) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch(src, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const blob = await res.blob();
        setState({
          kind: "ready",
          file: new File([blob], fileName, { type: "application/pdf" }),
        });
      })
      .catch((e: unknown) => {
        if ((e as Error).name !== "AbortError") setState({ kind: "error" });
      });
    return () => controller.abort();
  }, [src, fileName, attempt]);

  const share = useCallback(async () => {
    if (state.kind !== "ready") return;
    const { file } = state;
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title });
      } catch (e) {
        // Fechar a folha de partilha não é um erro.
        if ((e as Error).name !== "AbortError") download(file);
      }
      return;
    }
    download(file);
  }, [state, title]);

  return (
    <div className="flex flex-col gap-3">
      {state.kind === "error" ? (
        <div
          role="alert"
          className="rounded-campo bg-atraso-fundo px-4 py-3 text-etiqueta text-atraso-banner"
        >
          Não foi possível gerar o PDF.{" "}
          <button
            type="button"
            onClick={() => {
              setState({ kind: "loading" });
              setAttempt((n) => n + 1);
            }}
            className="min-h-11 font-extrabold underline underline-offset-4"
          >
            Tentar de novo
          </button>
        </div>
      ) : null}
      <Button
        type="button"
        onClick={share}
        disabled={state.kind !== "ready"}
        aria-busy={state.kind === "loading"}
      >
        <Share2 aria-hidden strokeWidth={2.2} />
        {state.kind === "loading" ? "A preparar o PDF…" : "Partilhar"}
      </Button>
      <div className="flex gap-3">
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          className="focus-visible:shadow-foco flex h-12 flex-1 items-center justify-center gap-2 rounded-capsula bg-menta text-etiqueta font-extrabold text-pinheiro-escuro outline-none"
        >
          <FileText className="size-5" strokeWidth={2.2} aria-hidden />
          Abrir PDF
        </a>
        <button
          type="button"
          disabled={state.kind !== "ready"}
          onClick={() => state.kind === "ready" && download(state.file)}
          className="focus-visible:shadow-foco flex h-12 flex-1 items-center justify-center gap-2 rounded-capsula bg-menta text-etiqueta font-extrabold text-pinheiro-escuro outline-none disabled:bg-desativado disabled:text-desativado-texto"
        >
          <Download className="size-5" strokeWidth={2.2} aria-hidden />
          Descarregar
        </button>
      </div>
    </div>
  );
}

function download(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
