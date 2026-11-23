import "server-only";

import { notFound, redirect } from "next/navigation";

import { getCurrentProfile } from "@/lib/auth/current-profile";
import { DELETED_ACCOUNT } from "@/lib/conta/labels";
import { createClient } from "@/lib/supabase/server";

import { isPetColor, type PetColor } from "./constants";
import { signPhotos } from "./data";
import { isPrecision, lifeSpan, type Precision } from "./tribute";

export type Memory = {
  id: string;
  body: string;
  photoUrl: string | null;
  /** Nome de quem escreveu («Conta apagada» se já não existe). */
  author: string;
  createdAt: string;
  /** Escrita por mim: posso editar e apagar. */
  mine: boolean;
  /** Posso apagar (a minha, ou sou dono). */
  canDelete: boolean;
};

export type Tribute = {
  id: string;
  name: string;
  species: string;
  sex: string | null;
  breed: string | null;
  color: PetColor;
  photoUrl: string | null;
  birthDate: string | null;
  deceasedOn: string;
  precision: Precision;
  lifeSpan: string;
  text: string | null;
  isOwner: boolean;
  memories: Memory[];
};

/** Página de tributo (ecrã 36). 404 sem acesso; quem não faleceu vai para a ficha. */
export async function getTribute(petId: string): Promise<Tribute> {
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const { data: pet } = await supabase
    .from("pets")
    .select(
      "id, name, species, sex, breed, color, birth_date, photo_path, deceased_on, deceased_precision, tribute_text, pet_members(user_id, role)",
    )
    .eq("id", petId)
    .maybeSingle();
  if (!pet) notFound();
  if (!pet.deceased_on) redirect(`/animais/${petId}`);

  const isOwner = pet.pet_members.some(
    (m) => m.user_id === profile.id && m.role === "owner",
  );

  const { data: rows } = await supabase
    .from("pet_memories")
    .select("id, body, photo_path, created_by, created_at")
    .eq("pet_id", petId)
    .order("created_at", { ascending: true });
  const memories = rows ?? [];

  const authorIds = [
    ...new Set(
      memories.map((m) => m.created_by).filter((i): i is string => !!i),
    ),
  ];
  const names = new Map<string, string>();
  if (authorIds.length) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name")
      .in("id", authorIds);
    for (const p of profiles ?? []) {
      if (p.name?.trim()) names.set(p.id, p.name.trim());
    }
  }

  const photos = await signPhotos(supabase, [
    pet.photo_path,
    ...memories.map((m) => m.photo_path),
  ]);

  return {
    id: pet.id,
    name: pet.name,
    species: pet.species,
    sex: pet.sex,
    breed: pet.breed,
    color: isPetColor(pet.color) ? pet.color : "laranja",
    photoUrl: pet.photo_path ? (photos.get(pet.photo_path) ?? null) : null,
    birthDate: pet.birth_date,
    deceasedOn: pet.deceased_on,
    precision: isPrecision(pet.deceased_precision)
      ? pet.deceased_precision
      : "day",
    lifeSpan: lifeSpan(pet.birth_date, pet.deceased_on),
    text: pet.tribute_text,
    isOwner,
    memories: memories.map((m) => {
      const mine = m.created_by === profile.id;
      return {
        id: m.id,
        body: m.body,
        photoUrl: m.photo_path ? (photos.get(m.photo_path) ?? null) : null,
        author: m.created_by
          ? (names.get(m.created_by) ?? "Alguém")
          : DELETED_ACCOUNT,
        createdAt: m.created_at,
        mine,
        canDelete: mine || isOwner,
      };
    }),
  };
}
