import { PageSkeleton } from "@/components/nav/skeleton";
import { Suspense } from "react";

import { FormHeader } from "@/components/pets/form-header";
import { PetForm } from "@/components/pets/pet-form";
import { nextFreeColor } from "@/lib/pets/constants";
import { usedColors } from "@/lib/pets/data";

export default function NovoAnimalPage() {
  return (
    <>
      <FormHeader title="Novo animal" />
      <Suspense fallback={<PageSkeleton />}>
        <Formulario />
      </Suspense>
    </>
  );
}

async function Formulario() {
  const color = nextFreeColor(await usedColors());
  return (
    <PetForm
      photoUrl={null}
      initial={{
        name: "",
        species: "",
        birthMode: "exact",
        birthDate: "",
        approxValue: "",
        approxUnit: "years",
        breed: "",
        sex: "",
        neutered: "",
        microchip: "",
        color,
        notes: "",
      }}
    />
  );
}
