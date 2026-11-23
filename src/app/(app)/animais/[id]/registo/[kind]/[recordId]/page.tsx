import { PageSkeleton } from "@/components/nav/skeleton";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import {
  DeleteRecordButton,
  EndMedicationButton,
} from "@/components/ficha/record-actions";
import { BackButton } from "@/components/nav/back-button";
import { formatISODate, todayISO } from "@/lib/dates";
import { getRecordDetail, isRecordKind } from "@/lib/ficha/data";
import { dueLabel, dueStatus } from "@/lib/ficha/due";

// Ecrã 19: detalhe de um registo (vacina, desparasitação, medicação, peso, análise…).
export default function RegistoPage({
  params,
}: PageProps<"/animais/[id]/registo/[kind]/[recordId]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Registo params={params} />
    </Suspense>
  );
}

async function Registo({
  params,
}: {
  params: PageProps<"/animais/[id]/registo/[kind]/[recordId]">["params"];
}) {
  const { id, kind, recordId } = await params;
  await connection(); // a data de hoje só se conhece no pedido
  if (!isRecordKind(kind)) notFound();
  const today = todayISO();
  const r = await getRecordDetail(id, kind, recordId, today);
  const dateLabel = r.kind === "medicacao" ? "Começou a" : "Data";

  const rows = [
    { label: dateLabel, value: formatISODate(r.date) },
    ...r.fields,
    ...(r.nextDue
      ? [
          {
            label: "Próxima data",
            value: `${formatISODate(r.nextDue)} · ${dueLabel(r.nextDue, today)}`,
            tone: dueStatus(r.nextDue, today),
          },
        ]
      : []),
  ];

  return (
    <>
      <BackButton />
      <header className="flex flex-col gap-1">
        <p className="text-etiqueta text-pinheiro">{r.typeLabel}</p>
        <h1 className="text-titulo tracking-tight">{r.title}</h1>
      </header>

      <dl className="overflow-hidden rounded-cartao border-[1.5px] border-linha bg-branco">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-baseline justify-between gap-4 border-b-[1.5px] border-linha-suave px-4 py-3.5 last:border-b-0"
          >
            <dt className="shrink-0 text-legenda text-tinta-suave">
              {row.label}
            </dt>
            <dd
              className={
                "tone" in row && row.tone === "overdue"
                  ? "text-right text-corpo font-bold text-atraso"
                  : "text-right text-corpo font-bold"
              }
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>

      {r.visit ? (
        <Link
          href={`/animais/${id}/consulta/${r.visit.id}`}
          className="focus-visible:shadow-foco flex min-h-16 items-center justify-between gap-3 rounded-cartao border-[1.5px] border-linha bg-branco px-4 py-3 outline-none"
        >
          <span className="flex min-w-0 flex-col">
            <span className="text-legenda text-tinta-suave">
              Registado na consulta
            </span>
            <span className="truncate text-corpo font-bold">
              {r.visit.label}
            </span>
          </span>
          <ChevronRight
            className="size-5 shrink-0 text-tinta-suave"
            strokeWidth={2.2}
            aria-hidden
          />
        </Link>
      ) : null}

      {r.notes ? (
        <section className="flex flex-col gap-1">
          <h2 className="text-etiqueta">Notas</h2>
          <p className="text-corpo whitespace-pre-line text-tinta-suave">
            {r.notes}
          </p>
        </section>
      ) : null}

      <p className="text-legenda text-tinta-suave">
        Registado por {r.createdByName} em{" "}
        {formatISODate(r.createdAt.slice(0, 10))}
      </p>

      {r.canEdit ? (
        <div className="flex flex-col gap-3">
          {r.endable ? <EndMedicationButton id={r.id} /> : null}
          <DeleteRecordButton
            kind={r.kind}
            id={r.id}
            petId={id}
            label={r.title}
          />
        </div>
      ) : null}
    </>
  );
}
