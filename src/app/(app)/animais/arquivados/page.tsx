import { PageSkeleton } from "@/components/nav/skeleton";
import { Suspense } from "react";

import { BackButton } from "@/components/nav/back-button";
import { PetAvatar } from "@/components/pets/pet-avatar";
import { ReactivateButton } from "@/components/pets/reactivate-button";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { shortDate } from "@/lib/pets/age";
import { listPets } from "@/lib/pets/data";
import { speciesLabel } from "@/lib/pets/labels";

// Ecrã 31: animais arquivados, só para consulta; o dono pode reativar.
export default function ArquivadosPage() {
  return (
    <>
      <BackButton />
      <h1 className="text-ecra tracking-tight">Animais arquivados</h1>
      <Suspense fallback={<PageSkeleton />}>
        <Arquivados />
      </Suspense>
    </>
  );
}

async function Arquivados() {
  const profile = await getCurrentProfile();
  const pets = await listPets(profile.id, true);

  return (
    <>
      <p className="text-corpo text-tinta-suave">
        Animais que já não estão contigo. O historial fica guardado, só para
        consulta.
      </p>
      {pets.length === 0 ? (
        <p className="text-corpo font-semibold">Não há animais arquivados.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {pets.map((pet) => (
            <li
              key={pet.id}
              className="flex flex-col gap-3.5 rounded-cartao border-[1.5px] border-linha bg-branco p-4"
            >
              <div className="flex items-center gap-4">
                <PetAvatar
                  name={pet.name}
                  color={pet.color}
                  photoUrl={pet.photoUrl}
                  species={pet.species}
                  petId={pet.id}
                  className="size-[72px] text-[30px]"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[22px] font-extrabold">
                    {pet.name}
                  </p>
                  <p className="text-legenda text-tinta-suave">
                    {speciesLabel(pet.species, pet.sex)}
                    {pet.age ? ` · ${pet.age}` : ""}
                  </p>
                  {pet.archivedAt ? (
                    <p className="text-[13px] font-semibold text-tinta-suave">
                      Arquivado a {shortDate(pet.archivedAt)}
                    </p>
                  ) : null}
                </div>
              </div>
              {pet.isOwner ? (
                <ReactivateButton petId={pet.id} name={pet.name} />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
