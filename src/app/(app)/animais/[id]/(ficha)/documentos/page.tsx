import { FileText } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { DocumentBrowser } from "@/components/documentos/document-browser";
import { EmptyState } from "@/components/nav/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { listDocuments } from "@/lib/documentos/data";

// Ecrã 11: documentos do animal, com pesquisa e filtro por tipo.
export default function DocumentosPage({
  params,
}: PageProps<"/animais/[id]/documentos">) {
  return (
    <Suspense fallback={<div className="flex-1" aria-hidden />}>
      <Documentos params={params} />
    </Suspense>
  );
}

async function Documentos({
  params,
}: {
  params: PageProps<"/animais/[id]/documentos">["params"];
}) {
  const { id } = await params;
  const docs = await listDocuments(id);
  const add = `/registar/documento?animal=${id}`;

  if (!docs.length) {
    return (
      <EmptyState
        icon={FileText}
        title="Ainda não há documentos"
        action={
          <Link href={add} className={buttonVariants({ size: "auto" })}>
            Adicionar documento
          </Link>
        }
      >
        Guarda aqui o boletim sanitário, o seguro, o chip e as faturas.
      </EmptyState>
    );
  }

  return (
    <>
      <div className="pb-20">
        <DocumentBrowser docs={docs} showPet={false} />
      </div>
      <div className="fixed inset-x-0 bottom-[calc(max(env(safe-area-inset-bottom),12px)+96px)] z-30">
        <div className="mx-auto w-full max-w-md px-5">
          <Link
            href={add}
            className={`${buttonVariants()} shadow-[0_0_0_8px_var(--color-nevoa)]`}
          >
            Adicionar documento
          </Link>
        </div>
      </div>
    </>
  );
}
