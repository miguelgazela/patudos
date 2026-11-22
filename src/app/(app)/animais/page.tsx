import { PawPrint, Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { EmptyState } from "@/components/nav/empty-state";
import { PetCardItem } from "@/components/pets/pet-card";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { listPets } from "@/lib/pets/data";
import { createClient } from "@/lib/supabase/server";

// Ecrã 7: os animais a que tenho acesso (os arquivados ficam à parte).
export default function AnimaisPage() {
  return (
    <Suspense fallback={<div className="flex-1" aria-hidden />}>
      <Animais />
    </Suspense>
  );
}

async function Animais() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const [pets, archived] = await Promise.all([
    listPets(profile.id, false),
    supabase
      .from("pets")
      .select("id", { count: "exact", head: true })
      .not("archived_at", "is", null),
  ]);
  const archivedCount = archived.count ?? 0;

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-ecra tracking-tight">Animais</h1>
        {pets.length > 0 ? (
          <Link
            href="/animais/novo"
            className={buttonVariants({
              size: "auto",
              className: "h-12 px-5",
            })}
          >
            <Plus className="size-5" strokeWidth={3} aria-hidden />
            Adicionar
          </Link>
        ) : null}
      </div>

      {pets.length === 0 ? (
        <EmptyState
          icon={PawPrint}
          title="Adiciona o teu primeiro patudo"
          action={
            <Link
              href="/animais/novo"
              className={buttonVariants({ className: "mt-2" })}
            >
              Adicionar animal
            </Link>
          }
        >
          Basta o nome e se é cão ou gato. Fotos, chip e raça podem ficar para
          depois.
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-4">
          {pets.map((pet) => (
            <li key={pet.id}>
              <PetCardItem pet={pet} />
            </li>
          ))}
        </ul>
      )}

      {archivedCount > 0 ? (
        <Link
          href="/animais/arquivados"
          className={buttonVariants({
            variant: "link",
            className: "self-center",
          })}
        >
          Animais arquivados ({archivedCount})
        </Link>
      ) : null}
    </>
  );
}
