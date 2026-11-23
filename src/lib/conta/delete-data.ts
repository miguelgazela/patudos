import "server-only";

import { signPhotos } from "@/lib/pets/data";
import { createClient } from "@/lib/supabase/server";

import type { PlanPet } from "./delete-plan";

type Client = Awaited<ReturnType<typeof createClient>>;

/** Os animais de quem apaga a conta, com todos os membros (ecrã 35). */
export async function loadPlanPets(
  supabase: Client,
  meId: string,
): Promise<PlanPet[]> {
  const { data } = await supabase
    .from("pets")
    .select(
      "id, name, species, sex, color, photo_path, pet_members(user_id, role, profiles(name))",
    )
    .order("name");
  const mine = (data ?? []).filter((p) =>
    p.pet_members.some((m) => m.user_id === meId),
  );
  const photos = await signPhotos(
    supabase,
    mine.map((p) => p.photo_path),
  );
  return mine.map((p) => ({
    id: p.id,
    name: p.name,
    species: p.species,
    sex: p.sex,
    color: p.color,
    photoUrl: p.photo_path ? (photos.get(p.photo_path) ?? null) : null,
    members: p.pet_members.map((m) => ({
      userId: m.user_id,
      name: m.profiles?.name?.trim() || "Alguém",
      role: m.role === "owner" ? "owner" : "caregiver",
    })),
  }));
}

const BUCKETS = ["fotos", "documentos"] as const;
const PAGE = 100;

async function listFiles(
  supabase: Client,
  bucket: (typeof BUCKETS)[number],
  prefix: string,
): Promise<string[]> {
  const out: string[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(prefix, { limit: PAGE, offset });
    if (error) throw new Error(error.message);
    for (const item of data ?? []) {
      // Pastas vêm sem `id`; ficheiros têm.
      if (item.id) out.push(`${prefix}/${item.name}`);
      else
        out.push(
          ...(await listFiles(supabase, bucket, `${prefix}/${item.name}`)),
        );
    }
    if ((data?.length ?? 0) < PAGE) return out;
  }
}

/**
 * Apaga todos os ficheiros de um animal (fotos e documentos) com a sessão do dono.
 * Idempotente: sem ficheiros, não faz nada. Lança se, depois de apagar, ainda restar algum
 * (o Storage devolve sucesso mesmo quando a política não deixa apagar).
 */
export async function removePetFiles(
  supabase: Client,
  petId: string,
): Promise<void> {
  for (const bucket of BUCKETS) {
    const files = await listFiles(supabase, bucket, petId);
    for (let i = 0; i < files.length; i += PAGE) {
      const { error } = await supabase.storage
        .from(bucket)
        .remove(files.slice(i, i + PAGE));
      if (error) throw new Error(error.message);
    }
    if (files.length && (await listFiles(supabase, bucket, petId)).length) {
      throw new Error(`Ficheiros por apagar em ${bucket}/${petId}`);
    }
  }
}
