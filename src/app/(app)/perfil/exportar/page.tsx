import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ExportPanel } from "@/components/conta/export-panel";

export const metadata: Metadata = { title: "Exportar os meus dados · Patudos" };

// Exportar os meus dados (ecrã 35): ZIP com dados.json, CSVs, fotos e documentos.
export default function ExportarPage() {
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
          Exportar os meus dados
        </h1>
      </header>
      <ExportPanel />
    </>
  );
}
