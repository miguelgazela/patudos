"use client";

import { Share, X } from "lucide-react";
import { useSyncExternalStore } from "react";

const KEY = "patudos:install-hint-dismissed";
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** Só mostra no iPhone/iPad dentro do Safari, com a app ainda por instalar e o aviso por dispensar. */
function getSnapshot(): boolean {
  const nav = window.navigator as Navigator & { standalone?: boolean };
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    nav.standalone === true;
  if (standalone || !/iPhone|iPad|iPod/.test(nav.userAgent)) return false;
  try {
    return localStorage.getItem(KEY) !== "1";
  } catch {
    return true;
  }
}

/** Aviso discreto (não bloqueia): sugere instalar a app para receber os lembretes. */
export function InstallHint() {
  const show = useSyncExternalStore(subscribe, getSnapshot, () => false);
  if (!show) return null;
  return (
    <aside
      data-testid="install-hint"
      className="flex items-center gap-3 rounded-cartao bg-menta py-2 pr-2 pl-4"
    >
      <Share
        className="size-6 shrink-0 text-pinheiro-escuro"
        strokeWidth={2.2}
        aria-hidden
      />
      <p className="min-w-0 flex-1 text-etiqueta font-extrabold text-pinheiro-escuro">
        Instala os Patudos no ecrã principal
        <span className="block font-semibold">
          Toca em Partilhar e depois em «Adicionar ao ecrã principal». Assim
          recebes os lembretes.
        </span>
      </p>
      <button
        type="button"
        aria-label="Dispensar o aviso de instalação"
        onClick={() => {
          try {
            localStorage.setItem(KEY, "1");
          } catch {
            // sem armazenamento: esconde só nesta sessão
          }
          listeners.forEach((l) => l());
        }}
        className="focus-visible:shadow-foco flex size-11 shrink-0 items-center justify-center rounded-full text-pinheiro-escuro outline-none"
      >
        <X className="size-5" strokeWidth={2.2} aria-hidden />
      </button>
    </aside>
  );
}
