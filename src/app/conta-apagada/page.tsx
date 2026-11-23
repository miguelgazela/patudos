import { CircleCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Conta apagada · Patudos",
  robots: { index: false },
};

// Fim do apagamento da conta (ecrã 35). Página pública: a sessão já não existe.
export default function ContaApagadaPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-5 px-5 py-10 pt-[max(env(safe-area-inset-top),40px)] pb-[max(env(safe-area-inset-bottom),40px)]">
      <span className="flex size-16 items-center justify-center rounded-full bg-feito-fundo text-feito">
        <CircleCheck className="size-8" strokeWidth={2.2} aria-hidden />
      </span>
      <h1 className="text-ecra tracking-tight">A tua conta foi apagada</h1>
      <p className="text-corpo text-tinta-suave">
        Apagámos o teu perfil e os dados que eram só teus. As cópias de
        segurança são eliminadas num prazo máximo de 30 dias.
      </p>
      <p className="text-corpo text-tinta-suave">
        Se quiseres voltar, basta entrar com o teu email: começas com uma conta
        nova e vazia.
      </p>
      <Link href="/" className={buttonVariants()}>
        Voltar ao início
      </Link>
    </main>
  );
}
