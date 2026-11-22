import "server-only";

import { createClient } from "@/lib/supabase/server";

import { formatAge } from "./age";
import { isPetColor, type PetColor } from "./constants";
import { sharedLine, type Member } from "./labels";

type Client = Awaited<ReturnType<typeof createClient>>;

export type PetCard = {
  id: string;
  name: string;
  species: string;
  sex: string | null;
  breed: string | null;
  color: PetColor;
  age: string | null;
  photoUrl: string | null;
  isOwner: boolean;
  shared: string;
  archivedAt: string | null;
};

/** URLs assinadas (1 h), criadas no servidor, por caminho. */
export async function signPhotos(
  supabase: Client,
  paths: (string | null)[],
): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter((p): p is string => !!p))];
  const map = new Map<string, string>();
  if (!unique.length) return map;
  const { data } = await supabase.storage
    .from("fotos")
    .createSignedUrls(unique, 3600);
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) map.set(item.path, item.signedUrl);
  }
  return map;
}

/** Animais a que tenho acesso (ativos ou arquivados), do mais antigo para o mais recente. */
export async function listPets(
  meId: string,
  archived: boolean,
): Promise<PetCard[]> {
  const supabase = await createClient();
  let query = supabase
    .from("pets")
    .select(
      "id, name, species, sex, breed, color, birth_date, photo_path, archived_at, pet_members(user_id, role, profiles(name))",
    )
    .order("created_at", { ascending: true });
  query = archived
    ? query.not("archived_at", "is", null).order("archived_at", {
        ascending: false,
      })
    : query.is("archived_at", null);

  const { data } = await query;
  const rows = data ?? [];
  const photos = await signPhotos(
    supabase,
    rows.map((r) => r.photo_path),
  );

  return rows.map((r) => {
    const members: Member[] = r.pet_members.map((m) => ({
      user_id: m.user_id,
      role: m.role,
      name: m.profiles?.name ?? null,
    }));
    return {
      id: r.id,
      name: r.name,
      species: r.species,
      sex: r.sex,
      breed: r.breed,
      color: isPetColor(r.color) ? r.color : "laranja",
      age: r.birth_date ? formatAge(r.birth_date) : null,
      photoUrl: r.photo_path ? (photos.get(r.photo_path) ?? null) : null,
      isOwner: members.some((m) => m.user_id === meId && m.role === "owner"),
      shared: sharedLine(members, meId),
      archivedAt: r.archived_at,
    };
  });
}

export async function usedColors(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("pets").select("color");
  return (data ?? []).map((p) => p.color);
}
