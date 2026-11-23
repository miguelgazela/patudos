import {
  ChevronRight,
  Pencil,
  Pill,
  Scale,
  Syringe,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";

import { BackButton } from "@/components/nav/back-button";
import { buttonVariants } from "@/components/ui/button";
import { formatISODate } from "@/lib/dates";
import { getVisitDetail } from "@/lib/ficha/data";
import { DOCUMENT_KIND_LABEL, eventTypeLabel } from "@/lib/ficha/labels";
import { formatCents, formatKg } from "@/lib/units";
import { describeRRule } from "@/lib/vet-visits/schedule";

// Ecrã 18: detalhe da consulta.
export default function ConsultaPage({
  params,
}: PageProps<"/animais/[id]/consulta/[visitId]">) {
  return (
    <Suspense fallback={<div className="flex-1" aria-hidden />}>
      <Consulta params={params} />
    </Suspense>
  );
}

const rowClass =
  "flex min-h-16 items-center gap-3 border-b-[1.5px] border-linha-suave px-3.5 py-3 last:border-b-0 focus-visible:shadow-foco outline-none";

function Item({
  href,
  icon: Icon,
  title,
  detail,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  detail?: string;
}) {
  return (
    <li>
      <Link href={href} className={rowClass}>
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-menta text-pinheiro-escuro">
          <Icon className="size-5" strokeWidth={2.2} aria-hidden />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[17px] font-bold">{title}</span>
          {detail ? (
            <span className="truncate text-legenda text-tinta-suave">
              {detail}
            </span>
          ) : null}
        </span>
        <ChevronRight
          className="size-5 shrink-0 text-tinta-suave"
          strokeWidth={2.2}
          aria-hidden
        />
      </Link>
    </li>
  );
}

function Block({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3" aria-labelledby={id}>
      <h2 id={id} className="text-seccao">
        {title}
      </h2>
      {children}
    </section>
  );
}

async function Consulta({
  params,
}: {
  params: PageProps<"/animais/[id]/consulta/[visitId]">["params"];
}) {
  const { id, visitId } = await params;
  const d = await getVisitDetail(id, visitId);
  const { visit } = d;
  const base = `/animais/${id}/registo`;
  const hasDone =
    d.events.length > 0 || d.medications.length > 0 || d.weight !== null;

  return (
    <>
      <BackButton />
      <header className="flex flex-col gap-1">
        <h1 className="text-titulo tracking-tight">
          {visit.reason ?? "Consulta"}
        </h1>
        <p className="text-corpo text-tinta-suave">
          {formatISODate(visit.visited_on)}
          {[visit.vet_name, visit.clinic].filter(Boolean).length
            ? ` · ${[visit.vet_name, visit.clinic].filter(Boolean).join(" · ")}`
            : ""}
        </p>
      </header>

      <Block id="feito" title="O que foi feito">
        {hasDone ? (
          <ul className="overflow-hidden rounded-cartao border-[1.5px] border-linha bg-branco">
            {d.events.map((e) => (
              <Item
                key={e.id}
                href={`${base}/evento/${e.id}`}
                icon={Syringe}
                title={e.title}
                detail={[
                  eventTypeLabel(e.type),
                  e.next_due_on
                    ? `próxima: ${formatISODate(e.next_due_on)}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              />
            ))}
            {d.medications.map((m) => (
              <Item
                key={m.id}
                href={`${base}/medicacao/${m.id}`}
                icon={Pill}
                title={[m.name, m.dose].filter(Boolean).join(" · ")}
                detail={[
                  describeRRule(m.schedule_rrule),
                  m.ends_on ? `até ${formatISODate(m.ends_on)}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              />
            ))}
            {d.weight !== null && d.weightId ? (
              <Item
                href={`${base}/peso/${d.weightId}`}
                icon={Scale}
                title={`Peso ${formatKg(d.weight)}`}
              />
            ) : null}
          </ul>
        ) : (
          <p className="rounded-cartao border-[1.5px] border-dashed border-linha px-4 py-5 text-corpo text-tinta-suave">
            Só a consulta, sem vacinas, medicação nem peso.
          </p>
        )}
      </Block>

      {d.expense ? (
        <Block id="custo" title="Custo">
          <div className="flex items-baseline justify-between gap-3 rounded-cartao border-[1.5px] border-linha bg-branco px-4 py-3.5">
            <span className="text-titulo tracking-tight">
              {formatCents(d.expense.amount_cents)}
            </span>
            {d.paidByName ? (
              <span className="text-legenda text-tinta-suave">
                Pago por {d.paidByName}
              </span>
            ) : null}
          </div>
        </Block>
      ) : null}

      {d.documents.length ? (
        <Block id="anexos" title="Anexos">
          <ul className="overflow-hidden rounded-cartao border-[1.5px] border-linha bg-branco">
            {d.documents.map((doc) => (
              <li key={doc.id}>
                <Link href={`/documentos/${doc.id}`} className={rowClass}>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[17px] font-bold">
                      {doc.title}
                    </span>
                    <span className="text-legenda text-tinta-suave">
                      {DOCUMENT_KIND_LABEL[doc.kind] ?? "Documento"}
                    </span>
                  </span>
                  <ChevronRight
                    className="size-5 shrink-0 text-tinta-suave"
                    strokeWidth={2.2}
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        </Block>
      ) : null}

      {visit.notes ? (
        <Block id="notas" title="Notas">
          <p className="text-corpo whitespace-pre-line text-tinta-suave">
            {visit.notes}
          </p>
        </Block>
      ) : null}

      <p className="text-legenda text-tinta-suave">
        Registada por {d.createdByName} em{" "}
        {formatISODate(visit.created_at.slice(0, 10))}
      </p>

      {d.canEdit ? (
        <Link
          href={`/registar/consulta/${visit.id}`}
          className={buttonVariants({ variant: "secondary" })}
        >
          <Pencil aria-hidden strokeWidth={2.2} />
          Editar ou apagar
        </Link>
      ) : null}
    </>
  );
}
