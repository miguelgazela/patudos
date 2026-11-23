import { ChevronRight } from "lucide-react";
import Link from "next/link";

import type { PetCard } from "@/lib/pets/data";

import { PetAvatar } from "./pet-avatar";

/** Linha discreta de um animal que faleceu: abre o tributo. */
export function MemorialRow({ pet }: { pet: PetCard }) {
  return (
    <Link
      href={`/animais/${pet.id}/tributo`}
      className="focus-visible:shadow-foco flex min-h-20 items-center gap-4 rounded-cartao border-[1.5px] border-linha bg-branco p-3.5 text-tinta outline-none"
    >
      <PetAvatar
        name={pet.name}
        color={pet.color}
        photoUrl={pet.photoUrl}
        species={pet.species}
        petId={pet.id}
        ring={false}
        className="size-14 text-[24px]"
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[19px] leading-tight font-extrabold [overflow-wrap:anywhere]">
          {pet.name}
        </span>
        {pet.lifeSpan ? (
          <span className="text-legenda text-tinta-suave">{pet.lifeSpan}</span>
        ) : null}
      </span>
      <ChevronRight
        className="size-6 shrink-0 text-tinta-suave"
        strokeWidth={2.2}
        aria-hidden
      />
    </Link>
  );
}
