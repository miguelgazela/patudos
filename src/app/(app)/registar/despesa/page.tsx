import { PawPrint } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { ExpenseForm } from "@/components/despesas/expense-form";
import { BackButton } from "@/components/nav/back-button";
import { EmptyState } from "@/components/nav/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { todayISO } from "@/lib/dates";
import { getVisitFormData } from "@/lib/vet-visits/data";

// Ecrã 26: nova despesa.
export default function Page({ searchParams }: PageProps<"/registar/despesa">) {
  return (
    <Suspense fallback={<div className="flex-1" aria-hidden />}>
      <Registar searchParams={searchParams} />
    </Suspense>
  );
}

async function Registar({
  searchParams,
}: {
  searchParams: PageProps<"/registar/despesa">["searchParams"];
}) {
  const { animal } = await searchParams;
  const data = await getVisitFormData(
    typeof animal === "string" ? animal : undefined,
  );

  if (data.pets.length === 0) {
    return (
      <>
        <BackButton />
        <EmptyState
          icon={PawPrint}
          title="Primeiro, adiciona um animal"
          action={
            <Link href="/animais/novo" className={buttonVariants()}>
              Adicionar animal
            </Link>
          }
        />
      </>
    );
  }

  return (
    <ExpenseForm
      pets={data.pets}
      meId={data.meId}
      initialPetIds={[data.initialPetId]}
      today={todayISO()}
    />
  );
}
