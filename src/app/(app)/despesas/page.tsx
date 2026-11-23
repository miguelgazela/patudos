import { PageSkeleton } from "@/components/nav/skeleton";
import { DELETED_ACCOUNT } from "@/lib/conta/labels";
import {
  Bone,
  ChevronLeft,
  ChevronRight,
  Hotel,
  Pill,
  Plus,
  Receipt,
  ShieldCheck,
  ShoppingBag,
  ShowerHead,
  Stethoscope,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { NoResults } from "@/components/nav/no-results";
import { EmptyState } from "@/components/nav/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { todayISO } from "@/lib/dates";
import { getExpensesPage, type ExpenseFilters } from "@/lib/despesas/data";
import { groupByDay } from "@/lib/despesas/group";
import {
  hasNext,
  monthName,
  parsePeriod,
  shiftPeriod,
  switchKind,
  type Period,
} from "@/lib/despesas/period";
import { EXPENSE_CATEGORY_LABEL } from "@/lib/ficha/labels";
import { colorStyles } from "@/lib/pets/constants";
import { formatCents } from "@/lib/units";
import { EXPENSE_CATEGORIES } from "@/lib/vet-visits/schema";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  veterinary: Stethoscope,
  medication: Pill,
  food: Bone,
  hygiene: ShowerHead,
  accessories: ShoppingBag,
  insurance: ShieldCheck,
  boarding: Hotel,
  other: Receipt,
};

const one = (v: string | string[] | undefined) =>
  typeof v === "string" && v ? v : undefined;

// Ecrã 25: despesas por período.
export default function DespesasPage({ searchParams }: PageProps<"/despesas">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Despesas searchParams={searchParams} />
    </Suspense>
  );
}

async function Despesas({
  searchParams,
}: {
  searchParams: PageProps<"/despesas">["searchParams"];
}) {
  const sp = await searchParams;
  await connection();
  const today = todayISO();
  const period = parsePeriod(sp.p, today);
  const filters: ExpenseFilters = {
    petId: one(sp.a),
    category: one(sp.c),
    paidBy: one(sp.q),
  };
  const { pets, payers, overview, meId } = await getExpensesPage(
    period,
    filters,
  );

  const petById = new Map(pets.map((p) => [p.id, p]));
  const payerName = (id: string | null) =>
    !id
      ? DELETED_ACCOUNT
      : id === meId
        ? "ti"
        : (payers.find((p) => p.id === id)?.name ?? "outra pessoa");

  /** URL com os filtros atuais, alterando só o que se pede. */
  const href = (
    change: Partial<Record<"p" | "a" | "c" | "q", string | null>>,
  ) => {
    const q = new URLSearchParams();
    const cur = {
      p: period.key,
      a: filters.petId,
      c: filters.category,
      q: filters.paidBy,
      ...change,
    };
    for (const [k, v] of Object.entries(cur)) if (v) q.set(k, v);
    return `/despesas?${q.toString()}`;
  };

  const prev = shiftPeriod(period, -1);
  const next = shiftPeriod(period, 1);
  const canNext = hasNext(period, today);
  const other: Period = switchKind(
    period,
    period.kind === "month" ? "year" : "month",
    today,
  );
  const hasFilters = !!(filters.petId || filters.category || filters.paidBy);
  const days = groupByDay(overview.items);
  const total = overview.totalCents;

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-ecra tracking-tight">Despesas</h1>
        <Link
          href={
            filters.petId
              ? `/registar/despesa?animal=${filters.petId}`
              : "/registar/despesa"
          }
          className={buttonVariants({ size: "auto" })}
        >
          <Plus className="size-5" strokeWidth={3} aria-hidden />
          Nova
        </Link>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Link
          href={href({ p: prev.key })}
          aria-label={period.kind === "month" ? "Mês anterior" : "Ano anterior"}
          className="focus-visible:shadow-foco flex size-12 shrink-0 items-center justify-center rounded-full bg-linha-suave text-tinta outline-none"
        >
          <ChevronLeft className="size-6" aria-hidden />
        </Link>
        <div className="flex flex-1 rounded-capsula bg-linha-suave p-1 text-etiqueta font-bold">
          {[period, other].map((p, i) => (
            <Link
              key={p.key}
              href={href({ p: p.key })}
              aria-current={i === 0 ? "true" : undefined}
              className={cn(
                "flex h-11 flex-1 items-center justify-center rounded-capsula",
                i === 0 ? "bg-branco text-tinta" : "text-tinta-suave",
              )}
            >
              {p.label}
            </Link>
          ))}
        </div>
        {canNext ? (
          <Link
            href={href({ p: next.key })}
            aria-label={
              period.kind === "month" ? "Mês seguinte" : "Ano seguinte"
            }
            className="focus-visible:shadow-foco flex size-12 shrink-0 items-center justify-center rounded-full bg-linha-suave text-tinta outline-none"
          >
            <ChevronRight className="size-6" aria-hidden />
          </Link>
        ) : (
          <span
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-linha-suave text-tinta opacity-40"
            aria-hidden
          >
            <ChevronRight className="size-6" />
          </span>
        )}
      </div>

      {/* Filtros: animal à vista, o resto em «Filtros» */}
      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
        <FilterChip active={!filters.petId} href={href({ a: null })}>
          Todos
        </FilterChip>
        {pets.map((p) => (
          <FilterChip
            key={p.id}
            active={filters.petId === p.id}
            href={href({ a: p.id })}
          >
            {p.name}
          </FilterChip>
        ))}
      </div>
      <details
        className="group rounded-cartao border-[1.5px] border-linha bg-branco"
        open={!!(filters.category || filters.paidBy)}
      >
        <summary className="focus-visible:shadow-foco flex min-h-12 cursor-pointer list-none items-center px-4 text-etiqueta font-bold outline-none [&::-webkit-details-marker]:hidden">
          Filtros: categoria e quem pagou
        </summary>
        <div className="flex flex-col gap-3 px-4 pb-4">
          <div className="flex flex-wrap gap-2">
            <FilterChip active={!filters.category} href={href({ c: null })}>
              Todas
            </FilterChip>
            {EXPENSE_CATEGORIES.map((c) => (
              <FilterChip
                key={c}
                active={filters.category === c}
                href={href({ c })}
              >
                {EXPENSE_CATEGORY_LABEL[c]}
              </FilterChip>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <FilterChip active={!filters.paidBy} href={href({ q: null })}>
              Quem pagou
            </FilterChip>
            {payers.map((p) => (
              <FilterChip
                key={p.id}
                active={filters.paidBy === p.id}
                href={href({ q: p.id })}
              >
                {p.name}
              </FilterChip>
            ))}
          </div>
        </div>
      </details>

      {overview.items.length === 0 ? (
        hasFilters ? (
          <NoResults clearHref={href({ a: null, c: null, q: null })}>
            Não há despesas deste período com estes filtros.
          </NoResults>
        ) : (
          <EmptyState
            icon={Wallet}
            title={
              period.kind === "month"
                ? `Sem despesas em ${monthName(period)}`
                : `Sem despesas em ${period.key}`
            }
            action={
              <Link href="/registar/despesa" className={buttonVariants()}>
                Nova despesa
              </Link>
            }
          >
            As consultas com custo aparecem aqui sozinhas. Ração, areia ou
            seguro? Junta-os aqui.
          </EmptyState>
        )
      ) : (
        <>
          <section
            className="flex flex-col gap-3 rounded-cartao border-[1.5px] border-linha bg-branco p-4"
            aria-label="Resumo"
          >
            <div>
              <p className="text-legenda text-tinta-suave">
                {period.kind === "month" ? "Total do mês" : "Total do ano"}
              </p>
              <p
                className="text-[38px] leading-[1.1] font-extrabold tracking-tight tabular-nums"
                data-testid="total"
              >
                {formatCents(total)}
              </p>
            </div>
            <div
              className="flex h-4 gap-[3px] overflow-hidden rounded-lg"
              role="img"
              aria-label={overview.byPet
                .map(
                  (b) =>
                    `${petById.get(b.petId)?.name ?? "Animal"} ${formatCents(b.cents)}`,
                )
                .join(", ")}
            >
              {overview.byPet.map((b) => (
                <span
                  key={b.petId}
                  className={
                    colorStyles[petById.get(b.petId)?.color ?? "laranja"].bg
                  }
                  style={{ width: `${total ? (b.cents / total) * 100 : 0}%` }}
                />
              ))}
            </div>
            <ul className="flex flex-col" data-testid="by-pet">
              {overview.byPet.map((b) => (
                <li
                  key={b.petId}
                  className="flex items-center gap-2.5 py-1.5 text-corpo font-bold"
                >
                  <span
                    className={cn(
                      "size-3 rounded-full",
                      colorStyles[petById.get(b.petId)?.color ?? "laranja"].bg,
                    )}
                    aria-hidden
                  />
                  {petById.get(b.petId)?.name ?? "Animal"}
                  <span className="ml-auto tabular-nums">
                    {formatCents(b.cents)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="h-px bg-linha-suave" />
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-legenda text-tinta-suave">
              <ul className="flex flex-col gap-1.5" data-testid="by-category">
                {overview.byCategory.map((c) => (
                  <li key={c.category} className="flex justify-between gap-2">
                    <span>
                      {EXPENSE_CATEGORY_LABEL[c.category] ?? c.category}
                    </span>
                    <b className="text-tinta tabular-nums">
                      {formatCents(c.cents)}
                    </b>
                  </li>
                ))}
              </ul>
              <ul className="flex flex-col gap-1.5" data-testid="by-payer">
                {overview.byPayer.map((c) => (
                  <li
                    key={c.paidBy ?? "none"}
                    className="flex justify-between gap-2"
                  >
                    <span>Pago por {payerName(c.paidBy)}</span>
                    <b className="text-tinta tabular-nums">
                      {formatCents(c.cents)}
                    </b>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {days.map((day) => (
            <section key={day.date} className="flex flex-col gap-2">
              <h2 className="text-etiqueta text-tinta-suave">{day.label}</h2>
              <ul className="overflow-hidden rounded-cartao border-[1.5px] border-linha bg-branco">
                {day.items.map((it) => {
                  const Icon = ICONS[it.category] ?? Receipt;
                  const petNames = it.pets
                    .map((p) => petById.get(p.petId)?.name ?? "Animal")
                    .join(", ");
                  return (
                    <li
                      key={it.id}
                      className="border-b-[1.5px] border-linha-suave last:border-b-0"
                    >
                      <Link
                        href={`/despesas/${it.id}`}
                        className="focus-visible:shadow-foco flex min-h-[68px] items-center gap-3 px-3.5 py-3 outline-none active:bg-nevoa"
                      >
                        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-menta text-pinheiro-escuro">
                          <Icon
                            className="size-5"
                            strokeWidth={2.2}
                            aria-hidden
                          />
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-[17px] font-bold">
                            {it.description?.trim() ||
                              EXPENSE_CATEGORY_LABEL[it.category] ||
                              "Despesa"}
                          </span>
                          <span className="truncate text-[13px] font-semibold text-tinta-suave">
                            {petNames} · {EXPENSE_CATEGORY_LABEL[it.category]} ·
                            pago por {payerName(it.paidBy)}
                          </span>
                        </span>
                        <span className="flex flex-col items-end">
                          <b className="tabular-nums">
                            {formatCents(it.amountCents)}
                          </b>
                          {it.totalCents !== it.amountCents ? (
                            <span className="text-[12px] font-semibold text-tinta-suave tabular-nums">
                              de {formatCents(it.totalCents)}
                            </span>
                          ) : null}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </>
      )}
    </>
  );
}

function FilterChip({
  active,
  href,
  children,
}: {
  active: boolean;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "focus-visible:shadow-foco flex h-chip shrink-0 items-center rounded-capsula px-4 text-etiqueta font-bold outline-none",
        active ? "bg-pinheiro text-branco" : "bg-linha-suave text-tinta",
      )}
    >
      {children}
    </Link>
  );
}
