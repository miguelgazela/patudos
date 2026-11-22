import Image from "next/image";

import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-5 py-10 text-center">
      <Image
        src="/icons/icon-192.png"
        alt="Logótipo dos Patudos"
        width={96}
        height={96}
        priority
        className="rounded-cartao"
      />
      <h1 className="text-ecra tracking-tight">Patudos</h1>
      <p className="text-corpo text-tinta-suave">
        A vida dos teus animais, simples e num só sítio.
      </p>
      <span className="inline-flex h-chip items-center rounded-capsula bg-menta px-4 text-etiqueta text-pinheiro-escuro">
        Cães e gatos
      </span>
      <Button>Começar</Button>
    </main>
  );
}
