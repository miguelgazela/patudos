import { PageSkeleton } from "@/components/nav/skeleton";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { FormHeader } from "@/components/pets/form-header";
import { TributeEditForm } from "@/components/tributo/tribute-edit-form";
import { getTribute } from "@/lib/pets/tribute-data";

export default function EditarTributoPage({
  params,
}: PageProps<"/animais/[id]/tributo/editar">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Editar params={params} />
    </Suspense>
  );
}

async function Editar({
  params,
}: {
  params: PageProps<"/animais/[id]/tributo/editar">["params"];
}) {
  const { id } = await params;
  const t = await getTribute(id);
  // Só o dono edita o tributo.
  if (!t.isOwner) redirect(`/animais/${id}/tributo`);
  return (
    <>
      <FormHeader title="Editar tributo" href={`/animais/${id}/tributo`} />
      <TributeEditForm
        petId={id}
        deceasedOn={t.deceasedOn}
        precision={t.precision}
        text={t.text ?? ""}
      />
    </>
  );
}
