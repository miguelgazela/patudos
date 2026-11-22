import { Suspense } from "react";

import { FichaHeader } from "@/components/ficha/header";
import { getPetHeader } from "@/lib/ficha/data";

// Ecrã 8: cabeçalho + separadores comuns a Resumo, Cronologia, Peso e Documentos.
export default function FichaLayout({
  params,
  children,
}: LayoutProps<"/animais/[id]">) {
  return (
    <>
      <Suspense fallback={<div className="min-h-72" aria-hidden />}>
        <Header params={params} />
      </Suspense>
      {children}
    </>
  );
}

async function Header({
  params,
}: {
  params: LayoutProps<"/animais/[id]">["params"];
}) {
  const { id } = await params;
  return <FichaHeader pet={await getPetHeader(id)} />;
}
