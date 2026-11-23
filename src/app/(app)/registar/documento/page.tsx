import { PageSkeleton } from "@/components/nav/skeleton";
import { PawPrint } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { DocumentForm } from "@/components/documentos/document-form";
import { BackButton } from "@/components/nav/back-button";
import { EmptyState } from "@/components/nav/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { todayISO } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { getVisitFormData } from "@/lib/vet-visits/data";

// Ecrã 27: adicionar um documento (`?animal=<id>` vem da ficha).
export default function Page({
  searchParams,
}: PageProps<"/registar/documento">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Registar searchParams={searchParams} />
    </Suspense>
  );
}

async function Registar({
  searchParams,
}: {
  searchParams: PageProps<"/registar/documento">["searchParams"];
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

  // O sexo só serve para o artigo do título sugerido («da Nina», «do Rex»).
  const supabase = await createClient();
  const { data: sexRows } = await supabase
    .from("pets")
    .select("id, sex")
    .in(
      "id",
      data.pets.map((p) => p.id),
    );
  const sexes: Record<string, "female" | "male" | null> = {};
  for (const r of sexRows ?? []) {
    sexes[r.id] = r.sex === "female" || r.sex === "male" ? r.sex : null;
  }

  return (
    <DocumentForm
      pets={data.pets}
      sexes={sexes}
      initialPetId={data.initialPetId}
      today={todayISO()}
    />
  );
}
