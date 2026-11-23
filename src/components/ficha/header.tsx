import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { PetAvatar } from "@/components/pets/pet-avatar";
import { colorStyles } from "@/lib/pets/constants";
import type { PetHeader, PetPerson } from "@/lib/ficha/data";
import { petSubtitle } from "@/lib/pets/labels";
import { cn } from "@/lib/utils";

import { CopyButton } from "./copy-button";
import { PetMenu } from "./pet-menu";
import { FichaTabs } from "./tabs";

function PersonAvatar({ person, me }: { person: PetPerson; me: boolean }) {
  return (
    <span
      title={me ? "Tu" : person.name}
      className="flex size-9 items-center justify-center rounded-full border-2 border-nevoa bg-menta text-etiqueta font-extrabold text-pinheiro-escuro"
    >
      {person.name.charAt(0).toUpperCase()}
    </span>
  );
}

/** Cabeçalho comum a todos os separadores da ficha (ecrã 8). */
export function FichaHeader({ pet }: { pet: PetHeader }) {
  const female = pet.sex === "female";
  const facts = [
    pet.neutered ? (female ? "Esterilizada" : "Esterilizado") : null,
  ].filter(Boolean);
  const names = pet.people.map((p) => (p.id === pet.meId ? "Tu" : p.name));
  const soft = colorStyles[pet.color].soft;

  return (
    <>
      <div className="flex items-center justify-between">
        <Link
          href="/animais"
          className="focus-visible:shadow-foco -ml-2 flex h-12 w-fit items-center gap-2 rounded-capsula px-2 text-corpo font-extrabold text-pinheiro outline-none"
        >
          <ArrowLeft className="size-6" strokeWidth={2.2} aria-hidden />
          Animais
        </Link>
        <PetMenu
          petId={pet.id}
          name={pet.name}
          isOwner={pet.isOwner}
          archived={pet.archived}
          deceased={pet.deceased}
        />
      </div>

      {pet.deceased ? (
        <Link
          href={`/animais/${pet.id}/tributo`}
          className="focus-visible:shadow-foco flex min-h-14 items-center justify-between gap-3 rounded-cartao bg-menta px-4 py-3 text-corpo font-extrabold text-pinheiro-escuro outline-none"
        >
          Em memória de {pet.name}
          <span className="text-etiqueta underline underline-offset-4">
            Ver tributo
          </span>
        </Link>
      ) : pet.archived ? (
        <p className="rounded-cartao bg-linha-suave px-4 py-3 text-etiqueta text-tinta-suave">
          Arquivado. O historial fica só para consulta.
        </p>
      ) : null}

      <header className="flex items-center gap-4">
        <PetAvatar
          name={pet.name}
          color={pet.color}
          photoUrl={pet.photoUrl}
          species={pet.species}
          petId={pet.id}
          className="size-24 text-[36px]"
        />
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="truncate text-ecra tracking-tight">{pet.name}</h1>
          <p className="text-corpo text-tinta-suave">
            {petSubtitle(pet, pet.age)}
          </p>
          {facts.length ? (
            <p className="flex flex-wrap gap-1.5">
              {facts.map((f) => (
                <span
                  key={f}
                  className={cn(
                    "rounded-capsula px-3 py-0.5 text-legenda",
                    soft,
                    colorStyles[pet.color].text,
                  )}
                >
                  {f}
                </span>
              ))}
            </p>
          ) : null}
        </div>
      </header>

      {pet.microchip ? (
        <div className="flex items-center justify-between gap-3 rounded-cartao border-[1.5px] border-linha bg-branco py-2 pr-2.5 pl-4">
          <div className="flex min-w-0 flex-col">
            <span className="text-legenda text-tinta-suave">Chip</span>
            <span className="truncate text-corpo font-bold">
              {pet.microchip}
            </span>
          </div>
          <CopyButton value={pet.microchip} />
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <ul className="flex -space-x-2" aria-label="Quem cuida">
          {pet.people.map((p) => (
            <li key={p.id}>
              <PersonAvatar person={p} me={p.id === pet.meId} />
            </li>
          ))}
        </ul>
        <p className="min-w-0 truncate text-legenda text-tinta-suave">
          {names.length > 1 ? `Cuidam: ${names.join(", ")}` : "Só tu cuidas"}
        </p>
      </div>

      <FichaTabs petId={pet.id} />
    </>
  );
}
