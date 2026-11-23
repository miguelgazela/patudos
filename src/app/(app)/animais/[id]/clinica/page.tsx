import { PageSkeleton } from "@/components/nav/skeleton";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { ClinicManager } from "@/components/clinicas/clinic-manager";
import { FormHeader } from "@/components/pets/form-header";
import { getKnownClinics } from "@/lib/clinics/data";
import { getPetHeader } from "@/lib/ficha/data";
import { createClient } from "@/lib/supabase/server";

// Clínica habitual do animal: escolher outra e editar telefone/morada (só o dono).
export default function ClinicaPage({
  params,
}: PageProps<"/animais/[id]/clinica">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Clinica params={params} />
    </Suspense>
  );
}

async function Clinica({
  params,
}: {
  params: PageProps<"/animais/[id]/clinica">["params"];
}) {
  const { id } = await params;
  const head = await getPetHeader(id);
  if (!head.isOwner) redirect(`/animais/${id}`);

  const supabase = await createClient();
  const [{ data: pet }, clinics] = await Promise.all([
    supabase.from("pets").select("clinic_id").eq("id", id).maybeSingle(),
    getKnownClinics(),
  ]);
  if (!pet) notFound();

  return (
    <>
      <FormHeader title={`Clínica de ${head.name}`} href={`/animais/${id}`} />
      <ClinicManager petId={id} currentId={pet.clinic_id} clinics={clinics} />
    </>
  );
}
