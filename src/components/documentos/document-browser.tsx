"use client";

import { Search, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Chip } from "@/components/consulta/ui";
import { formatISODate } from "@/lib/dates";
import type { DocumentListItem } from "@/lib/documentos/data";
import { DOCUMENT_CHIPS, filterDocuments } from "@/lib/documentos/logic";
import { DOCUMENT_KIND_LABEL } from "@/lib/ficha/labels";

import { kindStyle } from "./kind-style";

/**
 * Lista de documentos com pesquisa por título (ou animal) e filtro por tipo.
 * Usada na ficha (ecrã 11) e em /documentos (todos os animais).
 */
export function DocumentBrowser({
  docs,
  showPet,
}: {
  docs: DocumentListItem[];
  showPet: boolean;
}) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<string | null>(null);
  const shown = useMemo(
    () => filterDocuments(docs, { query, kind }),
    [docs, query, kind],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-tinta-suave"
          strokeWidth={2.2}
          aria-hidden
        />
        <input
          type="search"
          name="pesquisa"
          aria-label="Pesquisar documentos"
          placeholder="Pesquisar documentos"
          autoComplete="off"
          enterKeyHint="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="focus:shadow-foco h-campo w-full rounded-campo border-2 border-linha bg-branco pr-12 pl-12 text-corpo font-semibold text-tinta outline-none placeholder:text-placeholder focus:border-pinheiro"
        />
        {query ? (
          <button
            type="button"
            aria-label="Limpar pesquisa"
            onClick={() => setQuery("")}
            className="focus-visible:shadow-foco absolute top-1/2 right-1 flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-tinta-suave outline-none"
          >
            <X className="size-5" strokeWidth={2.2} aria-hidden />
          </button>
        ) : null}
      </div>

      <div
        role="group"
        aria-label="Filtrar por tipo"
        className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1"
      >
        <Chip selected={kind === null} onClick={() => setKind(null)}>
          Tudo
        </Chip>
        {DOCUMENT_CHIPS.map((c) => (
          <Chip
            key={c.kind}
            selected={kind === c.kind}
            onClick={() => setKind(kind === c.kind ? null : c.kind)}
            className="shrink-0"
          >
            {c.label}
          </Chip>
        ))}
      </div>

      {shown.length === 0 ? (
        <p
          className="py-8 text-center text-corpo text-tinta-suave"
          data-testid="sem-resultados"
        >
          Não encontrámos nenhum documento.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3" data-testid="documentos">
          {shown.map((d) => {
            const { icon: Icon, tone } = kindStyle(d.kind);
            return (
              <li key={d.id}>
                <Link
                  href={`/documentos/${d.id}`}
                  className="focus-visible:shadow-foco flex h-full flex-col overflow-hidden rounded-cartao border-[1.5px] border-linha bg-branco outline-none active:translate-y-px"
                >
                  <span
                    className={`flex h-[92px] items-center justify-center overflow-hidden ${tone}`}
                  >
                    {d.thumbUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={d.thumbUrl}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="size-full object-cover"
                      />
                    ) : (
                      <Icon className="size-9" strokeWidth={2.2} aria-hidden />
                    )}
                  </span>
                  <span className="flex flex-col gap-0.5 px-3 pt-2.5 pb-3">
                    <span className="line-clamp-2 text-[15px] leading-tight font-bold">
                      {d.title}
                    </span>
                    <span className="text-[13px] font-bold text-tinta-suave">
                      {DOCUMENT_KIND_LABEL[d.kind] ?? "Documento"} ·{" "}
                      {formatISODate(d.date)}
                    </span>
                    {showPet && d.petName ? (
                      <span className="text-[13px] font-bold text-pinheiro">
                        {d.petName}
                      </span>
                    ) : null}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
