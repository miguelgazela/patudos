import { PageSkeleton } from "@/components/nav/skeleton";
import { PawPrint } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { TreatmentForm } from "@/components/registar/treatment-form";
import { BackButton } from "@/components/nav/back-button";
import { EmptyState } from "@/components/nav/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { todayISO } from "@/lib/dates";
import { getVisitFormData } from "@/lib/vet-visits/data";

// Ecrã 16: registar um tratamento em casa.
export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Registar />
    </Suspense>
  );
}

async function Registar() {
  const data = await getVisitFormData();

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
    <TreatmentForm
      pets={data.pets}
      presets={data.presets}
      products={data.products}
      initialPetId={data.initialPetId}
      today={todayISO()}
    />
  );
}
