import { PageSkeleton } from "@/components/nav/skeleton";
import { Scale } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { WeightChart } from "@/components/ficha/weight-chart";
import { EmptyState } from "@/components/nav/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { formatISODate, todayISO } from "@/lib/dates";
import { getWeights } from "@/lib/ficha/data";
import {
  filterRange,
  parseRange,
  RANGE_LABEL,
  RANGES,
} from "@/lib/ficha/weights";
import { formatKg } from "@/lib/units";
import { cn } from "@/lib/utils";

export default function PesoPage({
  params,
  searchParams,
}: PageProps<"/animais/[id]/peso">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Peso params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Peso({
  params,
  searchParams,
}: {
  params: PageProps<"/animais/[id]/peso">["params"];
  searchParams: PageProps<"/animais/[id]/peso">["searchParams"];
}) {
  await connection(); // a data de hoje só se conhece no pedido
  const { id } = await params;
  const range = parseRange((await searchParams).periodo);
  const rows = await getWeights(id);
  const inRange = filterRange(
    rows.map((r) => ({ id: r.id, on: r.on, kg: r.kg })),
    range,
    todayISO(),
  );

  const register = (
    <Link
      href={`/registar/peso?animal=${id}`}
      className={buttonVariants({
        variant: rows.length ? "secondary" : "default",
      })}
    >
      Registar peso
    </Link>
  );

  if (!rows.length) {
    return (
      <EmptyState icon={Scale} title="Ainda não há pesagens" action={register}>
        Regista o primeiro peso para ver a evolução.
      </EmptyState>
    );
  }

  return (
    <>
      <nav aria-label="Período do gráfico">
        <ul className="grid grid-cols-3 gap-1 rounded-capsula bg-linha-suave p-1">
          {RANGES.map((r) => (
            <li key={r}>
              <Link
                href={
                  r === "tudo"
                    ? `/animais/${id}/peso`
                    : `/animais/${id}/peso?periodo=${r}`
                }
                replace
                aria-current={r === range ? "true" : undefined}
                className={cn(
                  "focus-visible:shadow-foco flex h-11 items-center justify-center rounded-capsula text-etiqueta font-bold outline-none",
                  r === range
                    ? "shadow-segmento bg-branco text-pinheiro"
                    : "text-tinta-suave",
                )}
              >
                {RANGE_LABEL[r]}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="rounded-cartao border-[1.5px] border-linha bg-branco p-3">
        {inRange.length ? (
          <WeightChart points={inRange} />
        ) : (
          <p className="px-2 py-8 text-center text-corpo text-tinta-suave">
            Sem pesagens neste período.
          </p>
        )}
      </div>

      {register}

      <section className="flex flex-col gap-3" aria-labelledby="pesagens">
        <h2 id="pesagens" className="text-seccao">
          Pesagens
        </h2>
        <ul className="overflow-hidden rounded-cartao border-[1.5px] border-linha bg-branco">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                href={`/animais/${id}/registo/peso/${r.id}`}
                className="focus-visible:shadow-foco flex min-h-16 items-center justify-between gap-3 border-b-[1.5px] border-linha-suave px-4 py-3 outline-none last:border-b-0"
              >
                <span className="flex flex-col">
                  <span className="text-[17px] font-bold">
                    {formatKg(r.kg)}
                  </span>
                  <span className="text-legenda text-tinta-suave">
                    {formatISODate(r.on)}
                  </span>
                </span>
                <span className="rounded-capsula bg-linha-suave px-3 py-1 text-legenda">
                  {r.inVisit ? "Na consulta" : "Em casa"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
