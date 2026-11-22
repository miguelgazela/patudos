"use client";

import { WifiOff } from "lucide-react";
import { useSyncExternalStore } from "react";

function subscribe(listener: () => void) {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}

/** Sem ligação: aviso por cima do conteúdo, em vez de uma app vazia. */
export function OfflineBanner() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  if (online) return null;

  return (
    <div
      role="alert"
      className="fixed inset-x-0 top-0 z-[60] px-5 pt-[max(env(safe-area-inset-top),12px)]"
    >
      <p className="shadow-segmento mx-auto flex max-w-md items-start gap-3 rounded-[20px] bg-aviso-fundo p-4 text-etiqueta text-aviso-banner">
        <WifiOff
          className="mt-0.5 size-5 shrink-0"
          strokeWidth={2.2}
          aria-hidden
        />
        <span>Sem ligação à internet. Tenta de novo daqui a pouco.</span>
      </p>
    </div>
  );
}
