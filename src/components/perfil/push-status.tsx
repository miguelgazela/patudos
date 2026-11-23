"use client";

import { useEffect, useState } from "react";

import { detect } from "./notificacoes-panel";
import type { PushState } from "@/lib/push/state";

const LABEL: Record<PushState, string> = {
  checking: "",
  install: "Instala a app primeiro",
  unsupported: "Não disponíveis neste dispositivo",
  denied: "Bloqueadas no iPhone",
  off: "Desligadas",
  on: "Ligadas",
};

/** Estado real das notificações neste dispositivo («Ligadas» / «Desligadas» / …). */
export function PushStatus() {
  const [state, setState] = useState<PushState>("checking");
  useEffect(() => {
    let live = true;
    detect().then((d) => {
      if (live) setState(d.state);
    });
    return () => {
      live = false;
    };
  }, []);

  if (state === "checking") return <span className="h-5" aria-hidden />;
  return (
    <span
      data-testid="push-status"
      className={
        state === "on"
          ? "text-legenda font-extrabold text-feito-texto"
          : "text-legenda text-tinta-suave"
      }
    >
      {LABEL[state]}
    </span>
  );
}
