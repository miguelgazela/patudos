import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { NotificacoesPanel } from "@/components/perfil/notificacoes-panel";

// Notificações (ecrã 24): ativar, estados (instalar, recusadas, não suportado) e teste.
export default function NotificacoesPage() {
  return (
    <>
      <header className="flex items-center gap-3">
        <Link
          href="/perfil"
          aria-label="Voltar"
          className="focus-visible:shadow-foco flex size-11 items-center justify-center rounded-full bg-linha-suave text-tinta outline-none"
        >
          <ArrowLeft className="size-6" strokeWidth={2.2} aria-hidden />
        </Link>
        <h1 className="text-[22px] font-extrabold tracking-tight">
          Notificações
        </h1>
      </header>
      <NotificacoesPanel />
    </>
  );
}
