"use client";

import { BellRing, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const KEY = "patudos:push-prompt-dismissed";

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

/** Convite discreto no Hoje: aparece quando há lembretes e nenhum dispositivo recebe notificações. */
export function PushPrompt() {
  const [hidden, setHidden] = useState(() =>
    typeof window === "undefined" ? true : wasDismissed(),
  );
  if (hidden) return null;
  return (
    <aside
      data-testid="push-prompt"
      className="flex items-center gap-3 rounded-cartao bg-menta py-2 pr-2 pl-4"
    >
      <BellRing
        className="size-6 shrink-0 text-pinheiro-escuro"
        strokeWidth={2.2}
        aria-hidden
      />
      <Link
        href="/perfil/notificacoes"
        className="focus-visible:shadow-foco -my-1 min-w-0 flex-1 rounded-campo py-1 text-etiqueta font-extrabold text-pinheiro-escuro outline-none"
      >
        Recebe os lembretes no telemóvel
        <span className="block font-semibold">Ativar notificações</span>
      </Link>
      <button
        type="button"
        aria-label="Agora não"
        onClick={() => {
          try {
            localStorage.setItem(KEY, "1");
          } catch {
            // sem armazenamento: esconde só nesta sessão
          }
          setHidden(true);
        }}
        className="focus-visible:shadow-foco flex size-11 shrink-0 items-center justify-center rounded-full text-pinheiro-escuro outline-none"
      >
        <X className="size-5" strokeWidth={2.2} aria-hidden />
      </button>
    </aside>
  );
}
