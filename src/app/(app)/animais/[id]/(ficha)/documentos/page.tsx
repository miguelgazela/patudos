import { ExternalLink, FileText, Image as ImageIcon } from "lucide-react";
import { Suspense } from "react";

import { EmptyState } from "@/components/nav/empty-state";
import { formatISODate } from "@/lib/dates";
import { getDocuments } from "@/lib/ficha/data";
import { DOCUMENT_KIND_LABEL } from "@/lib/ficha/labels";

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
  const docs = await getDocuments(id);

  if (!docs.length) {
    return (
      <EmptyState icon={FileText} title="Ainda não há documentos">
        Os anexos das consultas aparecem aqui. Juntar documentos avulsos
        (boletim, seguro, chip) chega em breve.
      </EmptyState>
    );
  }

  return (
    <ul className="overflow-hidden rounded-cartao border-[1.5px] border-linha bg-branco">
      {docs.map((d) => {
        const Icon = d.isImage ? ImageIcon : FileText;
        const inner = (
          <>
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-menta text-pinheiro-escuro">
              <Icon className="size-5" strokeWidth={2.2} aria-hidden />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[17px] font-bold">{d.title}</span>
              <span className="truncate text-legenda text-tinta-suave">
                {DOCUMENT_KIND_LABEL[d.kind] ?? "Documento"} ·{" "}
                {formatISODate(d.date)}
              </span>
            </span>
            <ExternalLink
              className="size-5 shrink-0 text-tinta-suave"
              strokeWidth={2.2}
              aria-hidden
            />
          </>
        );
        const cls =
          "flex min-h-16 items-center gap-3 border-b-[1.5px] border-linha-suave px-3.5 py-3 last:border-b-0 focus-visible:shadow-foco outline-none";
        return (
          <li key={d.id}>
            {d.url ? (
              <a href={d.url} target="_blank" rel="noreferrer" className={cls}>
                {inner}
              </a>
            ) : (
              <div className={cls}>{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
