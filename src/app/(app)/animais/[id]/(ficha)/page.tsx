import {
  Bug,
  ChevronRight,
  CalendarClock,
  Pill,
  Stethoscope,
  Syringe,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";

import { Sparkline } from "@/components/ficha/weight-chart";
import { buttonVariants } from "@/components/ui/button";
import { formatISODate, todayISO } from "@/lib/dates";
import { getSummary } from "@/lib/ficha/data";
import { dueLabel, upcomingDates, type DueStatus } from "@/lib/ficha/due";
import { eventTypeLabel } from "@/lib/ficha/labels";
import { formatDelta, weightVariation } from "@/lib/ficha/weights";
import { formatKg } from "@/lib/units";
import { describeRRule } from "@/lib/vet-visits/schedule";
import { cn } from "@/lib/utils";

export default function ResumoPage({ params }: PageProps<"/animais/[id]">) {
  return (
    <Suspense fallback={<div className="flex-1" aria-hidden />}>
      <Resumo params={params} />
    </Suspense>
  );
}

const cardClass =
  "overflow-hidden rounded-cartao border-[1.5px] border-linha bg-branco";
const rowClass =
  "flex min-h-16 items-center gap-3 border-b-[1.5px] border-linha-suave px-3.5 py-3 last:border-b-0 focus-visible:shadow-foco outline-none";

function Section({
  id,
  title,
  action,
  children,
}: {
  id: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3" aria-labelledby={id}>
      <div className="flex items-center justify-between gap-3">
        <h2 id={id} className="text-seccao">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-cartao border-[1.5px] border-dashed border-linha px-4 py-5 text-corpo text-tinta-suave">
      {children}
    </p>
  );
}

function IconBubble({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-menta text-pinheiro-escuro">
      <Icon className="size-5" strokeWidth={2.2} aria-hidden />
    </span>
  );
}

const statusStyle: Record<DueStatus, string> = {
  overdue: "bg-atraso-fundo text-atraso",
  today: "bg-aviso-fundo text-aviso",
  soon: "bg-menta text-pinheiro-escuro",
  later: "bg-linha-suave text-tinta-suave",
};

function typeIcon(type: string): LucideIcon {
  if (type === "vaccine") return Syringe;
  return type.startsWith("deworming") ? Bug : CalendarClock;
}

const MoreIcon = () => (
  <ChevronRight
    className="size-5 shrink-0 text-tinta-suave"
    strokeWidth={2.2}
    aria-hidden
  />
);

async function Resumo({
  params,
}: {
  params: PageProps<"/animais/[id]">["params"];
}) {
  await connection(); // a data de hoje só se conhece no pedido
  const { id } = await params;
  const today = todayISO();
  const base = `/animais/${id}`;
  const summary = await getSummary(id, today);

  const due = upcomingDates(summary.events, today);
  const weights = summary.weights;
  const lastWeight = weights[weights.length - 1] ?? null;
  const variation = weightVariation(weights);
  const visit = summary.lastVisit;

  return (
    <>
      <Link
        href={`/registar/consulta?animal=${id}`}
        className={buttonVariants()}
      >
        <Stethoscope aria-hidden strokeWidth={2.2} />
        Registar consulta
      </Link>

      <Section id="proximas" title="Próximas datas">
        {due.length ? (
          <ul className={cardClass}>
            {due.map((d) => {
              const Icon = typeIcon(d.type);
              return (
                <li key={d.id}>
                  <Link
                    href={`${base}/registo/evento/${d.id}`}
                    className={rowClass}
                  >
                    <IconBubble icon={Icon} />
                    <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
                      <span className="max-w-full truncate text-[17px] font-bold">
                        {d.title}
                      </span>
                      <span className="text-legenda text-tinta-suave">
                        {eventTypeLabel(d.type)} ·{" "}
                        {formatISODate(d.next_due_on)}
                      </span>
                      <span
                        className={cn(
                          "rounded-capsula px-3 py-0.5 text-legenda",
                          statusStyle[d.status],
                        )}
                      >
                        {dueLabel(d.next_due_on, today)}
                      </span>
                    </span>
                    <MoreIcon />
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty>
            Sem datas à vista. Quando registares uma vacina ou uma
            desparasitação, a próxima data aparece aqui.
          </Empty>
        )}
      </Section>

      <Section id="medicacao" title="Medicação ativa">
        {summary.medications.length ? (
          <ul className={cardClass}>
            {summary.medications.map((m) => (
              <li key={m.id}>
                <Link
                  href={`${base}/registo/medicacao/${m.id}`}
                  className={rowClass}
                >
                  <IconBubble icon={Pill} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[17px] font-bold">
                      {[m.name, m.dose].filter(Boolean).join(" · ")}
                    </span>
                    <span className="truncate text-legenda text-tinta-suave">
                      {[
                        describeRRule(m.schedule_rrule),
                        m.ends_on
                          ? `até ${formatISODate(m.ends_on)}`
                          : "sem data de fim",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <MoreIcon />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Sem medicação ativa.</Empty>
        )}
      </Section>

      <Section
        id="peso"
        title="Último peso"
        action={
          lastWeight ? (
            <Link
              href={`${base}/peso`}
              className="focus-visible:shadow-foco flex h-11 items-center rounded-capsula px-2 text-etiqueta font-bold text-pinheiro outline-none"
            >
              Ver tudo
            </Link>
          ) : null
        }
      >
        <div className={cn(cardClass, "flex flex-col gap-3 p-4")}>
          {lastWeight ? (
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col">
                <span className="text-titulo tracking-tight">
                  {formatKg(lastWeight.kg)}
                </span>
                <span className="text-legenda text-tinta-suave">
                  {formatISODate(lastWeight.on)}
                  {variation
                    ? ` · ${formatDelta(variation.deltaKg)} desde ${formatISODate(variation.since)}`
                    : ""}
                </span>
              </div>
              <Sparkline points={weights} />
            </div>
          ) : (
            <p className="text-corpo text-tinta-suave">
              Ainda não há pesagens.
            </p>
          )}
          <Link
            href={`/registar/peso?animal=${id}`}
            className={buttonVariants({ variant: "secondary" })}
          >
            Registar peso
          </Link>
        </div>
      </Section>

      <Section id="consulta" title="Última consulta">
        {visit ? (
          <ul className={cardClass}>
            <li>
              <Link href={`${base}/consulta/${visit.id}`} className={rowClass}>
                <IconBubble icon={Stethoscope} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[17px] font-bold">
                    {visit.reason ?? "Consulta"}
                  </span>
                  <span className="truncate text-legenda text-tinta-suave">
                    {formatISODate(visit.visited_on)}
                    {visit.vet_name ? ` · ${visit.vet_name}` : ""}
                  </span>
                  {visit.createdByName ? (
                    <span className="truncate text-legenda text-tinta-suave">
                      Registada por {visit.createdByName}
                    </span>
                  ) : null}
                </span>
                <MoreIcon />
              </Link>
            </li>
          </ul>
        ) : (
          <Empty>Ainda sem consultas registadas.</Empty>
        )}
      </Section>
    </>
  );
}
