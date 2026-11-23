import "server-only";

import { createClient } from "@/lib/supabase/server";
import { listPets, type PetCard } from "@/lib/pets/data";

export type PetNotify = Pick<
  PetCard,
  "id" | "name" | "species" | "color" | "photoUrl"
> & { notify: boolean };

/** Animais ativos com a minha preferência «Receber lembretes» + quantos animais arquivados. */
export async function getPerfilPets(
  meId: string,
): Promise<{ pets: PetNotify[]; archivedCount: number }> {
  const supabase = await createClient();
  const [pets, members, archived] = await Promise.all([
    listPets(meId, false),
    supabase.from("pet_members").select("pet_id, notify").eq("user_id", meId),
    supabase
      .from("pets")
      .select("id", { count: "exact", head: true })
      .not("archived_at", "is", null),
  ]);
  const notify = new Map(
    (members.data ?? []).map((m) => [m.pet_id, m.notify] as const),
  );
  return {
    pets: pets.map((p) => ({
      id: p.id,
      name: p.name,
      species: p.species,
      color: p.color,
      photoUrl: p.photoUrl,
      notify: notify.get(p.id) ?? true,
    })),
    archivedCount: archived.count ?? 0,
  };
}
