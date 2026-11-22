"use client";

import { Share, SquarePlus } from "lucide-react";
import { useSyncExternalStore, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

import { Logo } from "./auth-shell";

const DISMISSED_KEY = "patudos-instalar-dispensado";
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** `unknown` no servidor; depois `show` (iPhone/iPad no browser) ou `hide`. */
function getSnapshot(): "show" | "hide" {
  const nav = window.navigator as Navigator & { standalone?: boolean };
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    nav.standalone === true;
  const apple = /iPhone|iPad|iPod/.test(nav.userAgent);
  let dismissed = false;
  try {
    dismissed = window.sessionStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    // Sem armazenamento: mostra sempre; o link «Continuar» continua a funcionar em memória.
  }
  return apple && !standalone && !dismissed ? "show" : "hide";
}

function dismiss() {
  try {
    window.sessionStorage.setItem(DISMISSED_KEY, "1");
  } catch {}
  listeners.forEach((l) => l());
}

const steps = [
  {
    icon: <Share className="size-6" strokeWidth={2.2} aria-hidden />,
    text: "Toca no botão Partilhar, em baixo no Safari.",
  },
  {
    icon: <SquarePlus className="size-6" strokeWidth={2.2} aria-hidden />,
    text: "Escolhe «Adicionar ao ecrã principal».",
  },
  {
    icon: <Logo size={24} />,
    text: "Abre os Patudos a partir do ícone no ecrã principal.",
  },
];

/** Ecrã 1: no Safari, sem a app instalada, sugere instalar antes de entrar. */
export function InstallGate({ children }: { children: ReactNode }) {
  const mode = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => "unknown" as const,
  );

  if (mode === "unknown") return <div className="flex-1" aria-hidden />;
  if (mode === "hide") return <>{children}</>;

  return (
    <>
      <div className="flex flex-col items-center gap-4 text-center">
        <Logo />
        <h1 className="text-ecra tracking-tight">Instala os Patudos</h1>
        <p className="text-corpo text-tinta-suave">
          Assim recebes os lembretes dos teus animais, e a app abre num toque.
        </p>
      </div>
      <ol className="flex flex-col overflow-hidden rounded-cartao border-[1.5px] border-linha bg-branco">
        {steps.map((step, i) => (
          <li
            key={i}
            className="flex min-h-16 items-center gap-3 border-b-[1.5px] border-linha-suave px-4 py-3 last:border-b-0"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-menta text-pinheiro-escuro">
              {step.icon}
            </span>
            <span className="text-corpo font-bold">
              <span className="sr-only">Passo {i + 1}: </span>
              {step.text}
            </span>
          </li>
        ))}
      </ol>
      <p className="text-center text-legenda text-tinta-suave">
        Só com a app no ecrã principal recebes lembretes.
      </p>
      <Button
        type="button"
        variant="link"
        onClick={dismiss}
        className="mt-auto"
      >
        Continuar no browser
      </Button>
    </>
  );
}
