import { PageSkeleton } from "@/components/nav/skeleton";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { VisitEditForm } from "@/components/consulta/visit-edit-form";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { getKnownClinics } from "@/lib/clinics/data";
import { formatISODate, todayISO } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

// Ecrã 13 (variante): editar uma consulta existente.
export default function EditarConsultaPage({
  params,
}: PageProps<"/registar/consulta/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Editar params={params} />
    </Suspense>
  );
}

async function Editar({
  params,
}: {
  params: PageProps<"/registar/consulta/[id]">["params"];
}) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: visit } = await supabase
    .from("vet_visits")
    .select(
      "id, pet_id, visited_on, reason, clinic_id, notes, created_by, created_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (!visit) notFound();

  const [{ data: pet }, { data: member }, { data: creator }, clinics] =
    await Promise.all([
      supabase.from("pets").select("name").eq("id", visit.pet_id).single(),
      supabase
        .from("pet_members")
        .select("role")
        .eq("pet_id", visit.pet_id)
        .eq("user_id", profile.id)
        .maybeSingle(),
      visit.created_by
        ? supabase
            .from("profiles")
            .select("name")
            .eq("id", visit.created_by)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      getKnownClinics(),
    ]);

  // Só o dono ou quem registou a consulta a edita (a RLS também o garante).
  if (member?.role !== "owner" && visit.created_by !== profile.id) {
    redirect(`/animais/${visit.pet_id}`);
  }

  const who =
    visit.created_by === profile.id ? "ti" : (creator?.name ?? "outra pessoa");
  const current = clinics.find((c) => c.id === visit.clinic_id);

  return (
    <VisitEditForm
      visitId={visit.id}
      petId={visit.pet_id}
      petName={pet?.name ?? "animal"}
      today={todayISO()}
      initial={{
        visited_on: visit.visited_on,
        reason: visit.reason ?? "",
        clinic: current ? { id: current.id, name: current.name } : null,
        notes: visit.notes ?? "",
      }}
      clinics={clinics}
      registeredBy={`Registada por ${who} em ${formatISODate(visit.created_at.slice(0, 10))}`}
    />
  );
}
