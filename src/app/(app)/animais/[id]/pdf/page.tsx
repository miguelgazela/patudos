import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { PdfPreview } from "@/components/ficha/pdf-preview";
import { PdfShare } from "@/components/ficha/pdf-share";
import { todayISO } from "@/lib/dates";
import { getPetHeader } from "@/lib/ficha/data";
import { loadPdfRaw } from "@/lib/pdf/data";
import {
  buildPdfModel,
  parsePdfOptions,
  pdfFileName,
  type PdfOptions,
} from "@/lib/pdf/model";
import { cn } from "@/lib/utils";
import { notFound } from "next/navigation";

export default function PdfPage({
  params,
  searchParams,
}: PageProps<"/animais/[id]/pdf">) {
  return (
    <Suspense fallback={<div className="flex-1" aria-hidden />}>
      <Pdf params={params} searchParams={searchParams} />
    </Suspense>
  );
}

const optionClass =
  "focus-visible:shadow-foco flex min-h-12 flex-1 items-center justify-center rounded-capsula px-4 text-etiqueta font-extrabold outline-none";

function Choice<T extends string>({
  label,
  options,
  value,
  href,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  href: (v: T) => string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-2">
      <span className="text-etiqueta text-tinta-suave">{label}</span>
      <div className="flex gap-1 rounded-capsula bg-linha-suave p-1">
        {options.map((o) => (
          <Link
            key={o.value}
            href={href(o.value)}
            replace
            scroll={false}
            aria-current={o.value === value ? "true" : undefined}
            className={cn(
              optionClass,
              o.value === value
                ? "bg-branco text-pinheiro-escuro shadow-sm"
                : "text-tinta-suave",
            )}
          >
            {o.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

async function Pdf({
  params,
  searchParams,
}: Pick<PageProps<"/animais/[id]/pdf">, "params" | "searchParams">) {
  await connection();
  const { id } = await params;
  const options = parsePdfOptions(await searchParams);
  const [head, raw] = await Promise.all([getPetHeader(id), loadPdfRaw(id)]);
  if (!raw) notFound();

  const model = buildPdfModel(raw.raw, options, todayISO());
  const link = (patch: Partial<PdfOptions>) => {
    const o = { ...options, ...patch };
    return `/animais/${id}/pdf?incluir=${o.include}&periodo=${o.period}`;
  };
  const src = `/animais/${id}/pdf/ficha?incluir=${options.include}&periodo=${options.period}`;

  return (
    <>
      <header className="flex items-center gap-3">
        <Link
          href={`/animais/${id}`}
          aria-label="Voltar"
          className="focus-visible:shadow-foco flex size-11 items-center justify-center rounded-full bg-linha-suave text-tinta outline-none"
        >
          <ArrowLeft className="size-6" strokeWidth={2.2} aria-hidden />
        </Link>
        <h1 className="text-[22px] font-extrabold tracking-tight">
          Ficha de {head.name}
        </h1>
      </header>

      <Choice
        label="Incluir"
        value={options.include}
        options={[
          { value: "all", label: "Tudo" },
          { value: "vaccines", label: "Só vacinas" },
        ]}
        href={(v) => link({ include: v })}
      />
      <Choice
        label="Período"
        value={options.period}
        options={[
          { value: "year", label: "Último ano" },
          { value: "all", label: "Tudo" },
        ]}
        href={(v) => link({ period: v })}
      />

      <PdfShare
        key={src}
        src={src}
        fileName={pdfFileName(head.name)}
        title={`Ficha de ${head.name}`}
      />

      <PdfPreview
        model={model}
        petId={id}
        species={raw.species}
        color={raw.color}
        photoUrl={head.photoUrl}
      />
    </>
  );
}
