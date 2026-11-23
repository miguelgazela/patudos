"use client";

import { Check, CircleAlert } from "lucide-react";
import { useEffect, useState } from "react";

type Toast = {
  id: number;
  message: string;
  tone: "ok" | "erro";
  action?: { label: string; onClick: () => void };
};

type Listener = (t: Toast) => void;

const listeners = new Set<Listener>();
let nextId = 1;
// Confirmação feita antes de o <Toaster> existir (ex.: logo a seguir a uma navegação): fica à espera.
let pending: Toast | null = null;

/**
 * Confirmação curta, igual em toda a app («Consulta guardada»). Pode chamar-se antes de navegar:
 * o <Toaster> vive no layout de raiz e mantém-se entre ecrãs.
 * `action` (ex.: «Desfazer») só onde já existe essa possibilidade.
 */
export function showToast(
  message: string,
  opts: { tone?: "ok" | "erro"; action?: Toast["action"] } = {},
) {
  const toast: Toast = {
    id: nextId++,
    message,
    tone: opts.tone ?? "ok",
    action: opts.action,
  };
  if (listeners.size === 0) pending = toast;
  else listeners.forEach((l) => l(toast));
}

/** Uma confirmação de cada vez, por cima da barra inferior (com safe area). */
export function Toaster() {
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    const listener: Listener = (t) => setToast(t);
    listeners.add(listener);
    if (pending) {
      const p = pending;
      pending = null;
      // Fora do corpo síncrono do efeito, para não encadear renders.
      queueMicrotask(() => listener(p));
    }
    return () => {
      listeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(
      () => setToast(null),
      toast.action ? 7000 : toast.tone === "erro" ? 6000 : 3500,
    );
    return () => clearTimeout(t);
  }, [toast]);

  if (!toast) return null;
  const Icon = toast.tone === "erro" ? CircleAlert : Check;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-[calc(max(env(safe-area-inset-bottom),12px)+104px)] z-[70] flex justify-center px-5"
      data-testid="toast"
    >
      <div
        role={toast.tone === "erro" ? "alert" : "status"}
        className="pointer-events-auto flex max-w-md items-center gap-3 rounded-capsula bg-tinta py-3 pr-3 pl-4 text-etiqueta text-branco shadow-[0_8px_24px_rgba(14,31,28,.25)]"
      >
        <Icon
          className="size-5 shrink-0"
          strokeWidth={toast.tone === "erro" ? 2.2 : 2.8}
          aria-hidden
        />
        <span className="font-bold">{toast.message}</span>
        {toast.action ? (
          <button
            type="button"
            onClick={() => {
              toast.action?.onClick();
              setToast(null);
            }}
            className="focus-visible:shadow-foco h-11 shrink-0 rounded-capsula px-3 font-extrabold text-sol outline-none"
          >
            {toast.action.label}
          </button>
        ) : null}
      </div>
    </div>
  );
}
