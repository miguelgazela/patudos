import "server-only";

import { isPetColor, type PetColor } from "@/lib/pets/constants";
import { createClient } from "@/lib/supabase/server";

import { defaultAvatarPng, type PdfImage } from "./document";
import type { RawPdfData } from "./model";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PdfRaw = {
  id: string;
  species: string;
  raw: RawPdfData;
  color: PetColor;
  photoPath: string | null;
};

export type PdfSource = PdfRaw & { photo: PdfImage };

/**
 * Lê (com a sessão do próprio utilizador, logo com a RLS) tudo o que a ficha
 * precisa. `null` se não há sessão ou o animal não existe / não é dele.
 * Não lê despesas.
 */
export async function loadPdfRaw(petId: string): Promise<PdfRaw | null> {
  if (!UUID.test(petId)) return null;
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return null;

  const { data: pet } = await supabase
    .from("pets")
    .select(
      "id, name, species, sex, breed, color, birth_date, neutered, microchip, photo_path, clinics(name, phone, address), pet_members(user_id, role, profiles(name))",
    )
    .eq("id", petId)
    .maybeSingle();
  if (!pet) return null;

  const [events, meds, weights, visits] = await Promise.all([
    supabase
      .from("health_events")
      .select("type, title, product, occurred_on, next_due_on")
      .eq("pet_id", petId),
    supabase
      .from("medications")
      .select("name, dose, schedule_rrule, starts_on, ends_on")
      .eq("pet_id", petId),
    supabase
      .from("weights")
      .select("measured_on, weight_kg")
      .eq("pet_id", petId),
    supabase
      .from("vet_visits")
      .select(
        "visited_on, reason, vet_name, clinic, clinics(name, phone, address)",
      )
      .eq("pet_id", petId),
  ]);

  return {
    id: pet.id,
    species: pet.species,
    photoPath: pet.photo_path,
    color: isPetColor(pet.color) ? pet.color : "laranja",
    raw: {
      pet: {
        name: pet.name,
        species: pet.species,
        sex: pet.sex,
        breed: pet.breed,
        birth_date: pet.birth_date,
        neutered: pet.neutered,
        microchip: pet.microchip,
      },
      people: pet.pet_members.map((m) => ({
        name: m.profiles?.name?.trim() || "Alguém",
        role: m.role === "owner" ? "owner" : "caregiver",
      })),
      clinic: pet.clinics ?? null,
      events: events.data ?? [],
      medications: meds.data ?? [],
      weights: (weights.data ?? []).map((w) => ({
        measured_on: w.measured_on,
        weight_kg: Number(w.weight_kg),
      })),
      visits: visits.data ?? [],
    },
  };
}

/** Dados + a foto (ou o avatar por defeito) para desenhar o PDF. */
export async function loadPdfSource(petId: string): Promise<PdfSource | null> {
  const raw = await loadPdfRaw(petId);
  if (!raw) return null;
  const supabase = await createClient();
  const photo = await loadPhoto(supabase, raw.photoPath);
  return { ...raw, photo: photo ?? defaultAvatarPng(raw.species, raw.id) };
}

/** A foto vem do bucket privado (JPEG, reduzida no cliente); se falhar, usa-se o avatar por defeito. */
async function loadPhoto(
  supabase: Awaited<ReturnType<typeof createClient>>,
  path: string | null,
): Promise<PdfImage | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from("fotos").download(path);
  if (!data) return null;
  const bytes = Buffer.from(await data.arrayBuffer());
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
  if (isJpeg) return { data: bytes, format: "jpg" };
  if (isPng) return { data: bytes, format: "png" };
  return null;
}
