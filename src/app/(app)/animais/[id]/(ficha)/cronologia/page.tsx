import {
  Bug,
  CalendarClock,
  ChevronRight,
  FileText,
  Pill,
  Receipt,
  Scale,
  Stethoscope,
  Syringe,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { EmptyState } from "@/components/nav/empty-state";
import { formatISODate } from "@/lib/dates";
import { getTimeline } from "@/lib/ficha/data";
import {
  FILTERS,
  groupByMonth,
  matchesFilter,
  parseFilter,
  type EntryKind,
  type TimelineEntry,
} from "@/lib/ficha/timeline";
import { cn } from "@/lib/utils";

export default function CronologiaPage({
  params,
  searchParams,
}: PageProps<"/animais/[id]/cronologia">) {
  return (
    <Suspense fallback={<div className="flex-1" aria-hidden />}>
      <Cronologia params={params} searchParams={searchParams} />
    </Suspense>
  );
}

const ICONS: Record<EntryKind, LucideIcon> = {
  visit: Stethoscope,
  vaccine: Syringe,
  deworming: Bug,
  event: CalendarClock,
  medication: Pill,
  weight: Scale,
  expense: Receipt,
  document: FileText,
};

function EntryRow({ entry }: { entry: TimelineEntry }) {
  const Icon = ICONS[entry.kind];
  const inner = (
    <>
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-menta text-pinheiro-escuro">
        <Icon className="size-5" strokeWidth={2.2} aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[17px] font-bold">{entry.title}</span>
        <span className="text-legenda text-tinta-suave">
          {formatISODate(entry.date)}
        </span>
        {entry.summary ? (
          <span className="text-legenda text-tinta-suave">{entry.summary}</span>
        ) : null}
        {entry.createdBy ? (
          <span className="text-legenda text-tinta-suave">
            Registado por {entry.createdBy}
          </span>
        ) : null}
      </span>
      {entry.href ? (
        <ChevronRight
          className="size-5 shrink-0 text-tinta-suave"
          strokeWidth={2.2}
          aria-hidden
        />
      ) : null}
    </>
  );
  const cls =
    "flex min-h-16 items-center gap-3 border-b-[1.5px] border-linha-suave px-3.5 py-3 last:border-b-0 focus-visible:shadow-foco outline-none";
  if (!entry.href) return <div className={cls}>{inner}</div>;
  return (
    <Link href={entry.href} className={cls}>
      {inner}
    </Link>
  );
}

async function Cronologia({
  params,
  searchParams,
}: {
  params: PageProps<"/animais/[id]/cronologia">["params"];
  searchParams: PageProps<"/animais/[id]/cronologia">["searchParams"];
}) {
  const { id } = await params;
  const filter = parseFilter((await searchParams).filtro);
  const all = await getTimeline(id);
  const entries = all.filter((e) => matchesFilter(e, filter));
  const groups = groupByMonth(entries);

  return (
    <>
      <nav aria-label="Filtrar a cronologia" className="-mx-5">
        <ul className="flex [scrollbar-width:none] gap-2 overflow-x-auto px-5 pb-1">
          {FILTERS.map((f) => {
            const active = f.key === filter;
            return (
              <li key={f.key} className="shrink-0">
                <Link
                  href={
                    f.key === "tudo"
                      ? `/animais/${id}/cronologia`
                      : `/animais/${id}/cronologia?filtro=${f.key}`
                  }
                  replace
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "focus-visible:shadow-foco flex h-chip items-center rounded-capsula px-4 text-etiqueta font-bold outline-none",
                    active
                      ? "bg-pinheiro text-branco"
                      : "bg-linha-suave text-tinta",
                  )}
                >
                  {f.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {groups.length ? (
        groups.map((g) => (
          <section
            key={g.key}
            className="flex flex-col gap-3"
            aria-labelledby={`mes-${g.key}`}
          >
            <h2
              id={`mes-${g.key}`}
              className="text-seccao first-letter:uppercase"
            >
              {g.label}
            </h2>
            <ul className="overflow-hidden rounded-cartao border-[1.5px] border-linha bg-branco">
              {g.entries.map((e) => (
                <li key={e.key}>
                  <EntryRow entry={e} />
                </li>
              ))}
            </ul>
          </section>
        ))
      ) : (
        <EmptyState icon={CalendarClock} title="Nada por aqui">
          {filter === "tudo"
            ? "Ainda não há registos. Começa por registar uma consulta."
            : "Não há registos deste tipo."}
        </EmptyState>
      )}
    </>
  );
}
