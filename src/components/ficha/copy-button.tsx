"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

/** «Copiar» o n.º do chip. */
export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Sem permissão do browser: não há nada a mostrar além de não confirmar.
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="focus-visible:shadow-foco flex h-11 shrink-0 items-center gap-1.5 rounded-capsula bg-menta px-4 text-etiqueta font-bold text-pinheiro-escuro outline-none active:translate-y-px"
    >
      {copied ? (
        <Check className="size-5" strokeWidth={2.4} aria-hidden />
      ) : (
        <Copy className="size-5" strokeWidth={2.2} aria-hidden />
      )}
      <span role="status">{copied ? "Copiado" : "Copiar"}</span>
    </button>
  );
}
