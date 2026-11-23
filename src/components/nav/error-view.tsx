"use client";

import { CircleAlert, SearchX } from "lucide-react";
import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";

import { EmptyState } from "./empty-state";

/** Erro inesperado num ecrã: mensagem simpática, «Tentar de novo» e saída para o Hoje. */
export function ErrorView({ reset }: { reset: () => void }) {
  return (
    <div data-testid="erro-ecra" className="flex flex-1 flex-col">
      <EmptyState
        icon={CircleAlert}
        as="h1"
        title="Algo correu mal"
        action={
          <div className="mt-2 flex w-full flex-col gap-1">
            <Button type="button" onClick={reset}>
              Tentar de novo
            </Button>
            <Link href="/" className={buttonVariants({ variant: "link" })}>
              Ir para o Hoje
            </Link>
          </div>
        }
      >
        Não conseguimos mostrar este ecrã. Confirma a internet e tenta de novo.
        Os teus dados estão seguros.
      </EmptyState>
    </div>
  );
}

/** Página que não existe (ou animal/registo a que não tens acesso). */
export function NotFoundView() {
  return (
    <div data-testid="nao-encontrado" className="flex flex-1 flex-col">
      <EmptyState
        icon={SearchX}
        as="h1"
        title="Não encontrámos isto"
        action={
          <div className="mt-2 flex w-full flex-col gap-1">
            <Link href="/" className={buttonVariants()}>
              Ir para o Hoje
            </Link>
            <Link
              href="/animais"
              className={buttonVariants({ variant: "link" })}
            >
              Ver os meus animais
            </Link>
          </div>
        }
      >
        Esta página não existe ou já não está disponível.
      </EmptyState>
    </div>
  );
}
