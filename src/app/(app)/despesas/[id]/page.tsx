import { PageSkeleton } from "@/components/nav/skeleton";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import { ExpenseForm } from "@/components/despesas/expense-form";
import { BackButton } from "@/components/nav/back-button";
import { formatISODate, todayISO } from "@/lib/dates";
import { getExpenseDetail } from "@/lib/despesas/data";
import { EXPENSE_CATEGORY_LABEL } from "@/lib/ficha/labels";
import { formatCents } from "@/lib/units";
import { getVisitFormData } from "@/lib/vet-visits/data";

// Ecrã 26 em edição.
export default function Page({ params }: PageProps<"/despesas/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Detail params={params} />
    </Suspense>
  );
}

async function Detail({
  params,
}: {
  params: PageProps<"/despesas/[id]">["params"];
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [detail, form] = await Promise.all([
    getExpenseDetail(id),
    getVisitFormData(),
  ]);

  if (!detail.canEdit) {
    const mine = detail.splits.reduce((s, x) => s + x.cents, 0);
    const names = detail.splits
      .map((s) => form.pets.find((p) => p.id === s.petId)?.name)
      .filter(Boolean)
      .join(", ");
    return (
      <>
        <BackButton />
        <h1 className="text-ecra tracking-tight">Despesa</h1>
        <div className="flex flex-col gap-2 rounded-cartao border-[1.5px] border-linha bg-branco p-4">
          <p className="text-titulo tabular-nums">{formatCents(mine)}</p>
          <p className="text-corpo font-semibold">
            {EXPENSE_CATEGORY_LABEL[detail.category] ?? "Despesa"}
            {detail.description ? ` · ${detail.description}` : ""}
          </p>
          <p className="text-legenda text-tinta-suave">
            {names} · {formatISODate(detail.spentOn)}
            {detail.paidByName ? ` · pago por ${detail.paidByName}` : ""}
          </p>
          {detail.createdByName ? (
            <p className="text-legenda text-tinta-suave">
              Registada por {detail.createdByName}
            </p>
          ) : null}
          {detail.document?.url ? (
            <a
              href={detail.document.url}
              target="_blank"
              rel="noreferrer"
              className="text-etiqueta font-extrabold text-pinheiro underline underline-offset-4"
            >
              Abrir fatura
            </a>
          ) : null}
        </div>
        <p className="text-legenda text-tinta-suave">
          Só quem registou a despesa ou o dono dos animais a pode editar.
        </p>
      </>
    );
  }

  return (
    <ExpenseForm
      pets={form.pets}
      meId={form.meId}
      initialPetIds={[]}
      today={todayISO()}
      initial={{
        id: detail.id,
        amountCents: detail.amountCents,
        category: detail.category,
        spentOn: detail.spentOn,
        description: detail.description,
        paidBy: detail.paidBy,
        paidByName: detail.paidByName,
        visitHref: detail.visitHref,
        document: detail.document,
        splits: detail.splits,
        locked:
          detail.hasHiddenParts ||
          detail.splits.some((s) => !form.pets.some((p) => p.id === s.petId)),
      }}
    />
  );
}
