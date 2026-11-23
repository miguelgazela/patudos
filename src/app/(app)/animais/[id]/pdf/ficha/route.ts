import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";

import { todayISO } from "@/lib/dates";
import { loadPdfSource } from "@/lib/pdf/data";
import { FichaPdf } from "@/lib/pdf/document";
import { buildPdfModel, parsePdfOptions, pdfFileName } from "@/lib/pdf/model";

export const maxDuration = 30;

const NOT_FOUND = () =>
  new Response("Não encontrado", {
    status: 404,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "private, no-store",
    },
  });

/**
 * Ficha do animal em PDF (ecrã 32). Corre com a sessão de quem pede (cookies +
 * RLS): quem não é membro do animal recebe 404. Nunca usa a service role.
 * `?incluir=all|vaccines&periodo=year|all`; `?descarregar=1` força o descarregamento.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(request.url);
  const source = await loadPdfSource(id);
  if (!source) return NOT_FOUND();

  const options = parsePdfOptions(url.searchParams);
  const model = buildPdfModel(source.raw, options, todayISO());
  const buffer = await renderToBuffer(
    createElement(FichaPdf, {
      model,
      photo: source.photo,
      color: source.color,
    }) as unknown as Parameters<typeof renderToBuffer>[0],
  );

  const filename = pdfFileName(source.raw.pet.name);
  const disposition = url.searchParams.has("descarregar")
    ? "attachment"
    : "inline";
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(buffer.length),
      "Content-Disposition": `${disposition}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
