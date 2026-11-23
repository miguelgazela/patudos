import { PageSkeleton } from "@/components/nav/skeleton";
import { FileText } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { DocumentBrowser } from "@/components/documentos/document-browser";
import { BackButton } from "@/components/nav/back-button";
import { EmptyState } from "@/components/nav/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { listDocuments } from "@/lib/documentos/data";

// Documentos de todos os animais, com pesquisa: «encontro qualquer documento em segundos».
export default function Page() {
  return (
    <>
      <BackButton />
      <h1 className="text-ecra tracking-tight">Documentos</h1>
      <Suspense fallback={<PageSkeleton />}>
        <Lista />
      </Suspense>
    </>
  );
}

async function Lista() {
  const docs = await listDocuments();
  if (!docs.length) {
    return (
      <EmptyState
        icon={FileText}
        title="Ainda não há documentos"
        action={
          <Link
            href="/registar/documento"
            className={buttonVariants({ size: "auto" })}
          >
            Adicionar documento
          </Link>
        }
      >
        Guarda aqui boletins, seguros, certificados de chip e faturas.
      </EmptyState>
    );
  }
  return (
    <>
      <DocumentBrowser docs={docs} showPet />
      <Link href="/registar/documento" className={buttonVariants()}>
        Adicionar documento
      </Link>
    </>
  );
}
