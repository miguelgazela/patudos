import type { Species } from "./constants";

/** «Cadela», «Cão», «Gata», «Gato». */
export function speciesLabel(species: string, sex: string | null): string {
  if (species === "cat") return sex === "female" ? "Gata" : "Gato";
  return sex === "female" ? "Cadela" : "Cão";
}

/** «Cadela · Podengo · 4 anos» */
export function petSubtitle(
  pet: { species: string; sex: string | null; breed: string | null },
  age: string | null,
): string {
  return [speciesLabel(pet.species, pet.sex), pet.breed, age]
    .filter(Boolean)
    .join(" · ");
}

export type Member = { user_id: string; role: string; name: string | null };

/** «Partilhado com Mãe, Pai» · «Cuidas com Pedro» · «Só tu». */
export function sharedLine(members: Member[], meId: string): string {
  const me = members.find((m) => m.user_id === meId);
  const others = members
    .filter((m) => m.user_id !== meId)
    .map((m) => m.name?.trim() || "Alguém");
  if (me?.role === "owner") {
    return others.length ? `Partilhado com ${others.join(", ")}` : "Só tu";
  }
  return others.length
    ? `Cuidas com ${others.join(", ")}`
    : "Cuidas deste animal";
}

export type { Species };
