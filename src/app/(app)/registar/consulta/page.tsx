import { PageSkeleton } from "@/components/nav/skeleton";
import { PawPrint } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { VisitForm } from "@/components/consulta/visit-form";
import { BackButton } from "@/components/nav/back-button";
import { EmptyState } from "@/components/nav/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { todayISO } from "@/lib/dates";
import { getVisitFormData } from "@/lib/vet-visits/data";

// Ecrã 13: registar uma consulta completa num só ecrã.
export default function RegistarConsultaPage({
  searchParams,
}: PageProps<"/registar/consulta">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Registar searchParams={searchParams} />
    </Suspense>
  );
}

async function Registar({
  searchParams,
}: {
  searchParams: PageProps<"/registar/consulta">["searchParams"];
}) {
  // `?animal=<id>` (vindo da ficha) pré-seleciona esse animal.
  const animal = (await searchParams).animal;
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
    <VisitForm
      pets={data.pets}
      presets={data.presets}
      initialPetId={data.initialPetId}
      today={todayISO()}
      clinics={data.clinics}
      products={data.products}
      medicines={data.medicines}
    />
  );
}
