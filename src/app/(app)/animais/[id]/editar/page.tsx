import { PageSkeleton } from "@/components/nav/skeleton";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { ArchiveButton } from "@/components/pets/archive-button";
import { FormHeader } from "@/components/pets/form-header";
import { PetForm } from "@/components/pets/pet-form";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { approxFromBirthDate } from "@/lib/pets/age";
import { isPetColor } from "@/lib/pets/constants";
import { signPhotos } from "@/lib/pets/data";
import { createClient } from "@/lib/supabase/server";

export default function EditarAnimalPage({
  params,
}: PageProps<"/animais/[id]/editar">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Editar params={params} />
    </Suspense>
  );
}

async function Editar({
  params,
}: {
  params: PageProps<"/animais/[id]/editar">["params"];
}) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: pet } = await supabase
    .from("pets")
    .select("*, pet_members(user_id, role)")
    .eq("id", id)
    .maybeSingle();
  if (!pet) notFound();
  // Só o dono edita a ficha.
  const isOwner = pet.pet_members.some(
    (m) => m.user_id === profile.id && m.role === "owner",
  );
  if (!isOwner) redirect("/animais");

  const photos = await signPhotos(supabase, [pet.photo_path]);
  const approx =
    pet.birth_date && pet.birth_date_is_estimate
      ? approxFromBirthDate(pet.birth_date)
      : null;

  return (
    <>
      <FormHeader title={`Editar ${pet.name}`} />
      <PetForm
        petId={pet.id}
        photoUrl={pet.photo_path ? (photos.get(pet.photo_path) ?? null) : null}
        initial={{
          name: pet.name,
          species: pet.species === "cat" ? "cat" : "dog",
          birthMode: approx ? "approx" : "exact",
          birthDate: pet.birth_date_is_estimate ? "" : (pet.birth_date ?? ""),
          approxValue: approx ? String(approx.value) : "",
          approxUnit: approx?.unit ?? "years",
          breed: pet.breed ?? "",
          sex: pet.sex === "female" || pet.sex === "male" ? pet.sex : "",
          neutered: pet.neutered === null ? "" : pet.neutered ? "yes" : "no",
          microchip: pet.microchip ?? "",
          color: isPetColor(pet.color) ? pet.color : "laranja",
          notes: pet.notes ?? "",
        }}
      />
      <ArchiveButton petId={pet.id} name={pet.name} />
    </>
  );
}
