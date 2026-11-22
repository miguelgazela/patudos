import { PawPrint } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { WeightForm } from "@/components/registar/weight-form";
import { BackButton } from "@/components/nav/back-button";
import { EmptyState } from "@/components/nav/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { todayISO } from "@/lib/dates";
import { getVisitFormData } from "@/lib/vet-visits/data";

// Ecrã 17: registar um peso.
export default function Page({ searchParams }: PageProps<"/registar/peso">) {
  return (
    <Suspense fallback={<div className="flex-1" aria-hidden />}>
      <Registar searchParams={searchParams} />
    </Suspense>
  );
}

async function Registar({
  searchParams,
}: {
  searchParams: PageProps<"/registar/peso">["searchParams"];
}) {
  // `?animal=<id>`: atalho a partir da ficha do animal.
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
    <WeightForm
      pets={data.pets}
      initialPetId={data.initialPetId}
      today={todayISO()}
    />
  );
}
