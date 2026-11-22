import { ChevronRight } from "lucide-react";
import Link from "next/link";

import type { PetCard as Pet } from "@/lib/pets/data";
import { petSubtitle } from "@/lib/pets/labels";

import { PetAvatar } from "./pet-avatar";

/** Cartão grande do ecrã 7. O dono abre a ficha para editar; o cuidador só vê. */
export function PetCardItem({ pet }: { pet: Pet }) {
  const body = (
    <>
      <PetAvatar
        name={pet.name}
        color={pet.color}
        photoUrl={pet.photoUrl}
        className="size-20 text-[32px]"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="truncate text-[24px] leading-tight font-extrabold">
          {pet.name}
        </p>
        <p className="text-legenda text-tinta-suave">
          {petSubtitle(pet, pet.age)}
        </p>
        <p className="mt-1.5 text-legenda text-tinta-suave">{pet.shared}</p>
      </div>
      {pet.isOwner ? (
        <ChevronRight
          className="size-6 shrink-0 text-tinta-suave"
          strokeWidth={2.2}
          aria-hidden
        />
      ) : null}
    </>
  );
  const cls =
    "flex items-center gap-4 rounded-cartao border-[1.5px] border-linha bg-branco p-4 text-tinta";

  return pet.isOwner ? (
    <Link
      href={`/animais/${pet.id}/editar`}
      className={`${cls} focus-visible:shadow-foco outline-none`}
    >
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
