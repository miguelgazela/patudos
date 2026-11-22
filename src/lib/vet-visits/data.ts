import "server-only";

import { cookies } from "next/headers";

import { getCurrentProfile } from "@/lib/auth/current-profile";
import { isPetColor, type PetColor } from "@/lib/pets/constants";
import { signPhotos } from "@/lib/pets/data";
import { createClient } from "@/lib/supabase/server";

export const LAST_PET_COOKIE = "patudos_last_pet";

export type FormPet = {
  id: string;
  name: string;
  species: "dog" | "cat";
  color: PetColor;
  photoUrl: string | null;
  /** Quem pode pagar: os membros do animal (eu primeiro). */
  members: { id: string; name: string }[];
  lastWeight: { kg: number; on: string } | null;
  /** Veterinário usado na última consulta deste animal. */
  lastVet: string | null;
};

export type FormPreset = {
  id: string;
  species: "dog" | "cat";
  type: "vaccine" | "deworming_internal" | "deworming_external";
  name: string;
  intervalMonths: number;
};

export type VisitFormData = {
  meId: string;
  meName: string;
  pets: FormPet[];
  presets: FormPreset[];
  initialPetId: string;
  /** Sugestões do histórico (as mais recentes primeiro, sem repetidos). */
  vets: string[];
  products: string[];
  medicines: string[];
};

function distinct(values: (string | null)[], max = 12): string[] {
  const out: string[] = [];
  for (const v of values) {
    const t = v?.trim();
    if (t && !out.some((o) => o.toLowerCase() === t.toLowerCase())) out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

/** Tudo o que o ecrã «Registar consulta» precisa para pré-preencher. */
export async function getVisitFormData(
  preferredPetId?: string,
): Promise<VisitFormData> {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const [petsRes, presetsRes, visitsRes, eventsRes, medsRes, weightsRes] =
    await Promise.all([
      supabase
        .from("pets")
        .select(
          "id, name, species, color, photo_path, pet_members(user_id, profiles(name))",
        )
        .is("archived_at", null)
        .order("created_at", { ascending: true }),
      supabase
        .from("care_presets")
        .select("id, species, type, name, interval_months")
        .order("sort_order"),
      supabase
        .from("vet_visits")
        .select("pet_id, vet_name")
        .not("vet_name", "is", null)
        .order("visited_on", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(60),
      supabase
        .from("health_events")
        .select("product")
        .not("product", "is", null)
        .order("created_at", { ascending: false })
        .limit(60),
      supabase
        .from("medications")
        .select("name")
        .order("created_at", { ascending: false })
        .limit(60),
      supabase
        .from("weights")
        .select("pet_id, weight_kg, measured_on")
        .order("measured_on", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

  const petRows = petsRes.data ?? [];
  const photos = await signPhotos(
    supabase,
    petRows.map((p) => p.photo_path),
  );
  const visits = visitsRes.data ?? [];
  const lastVetOverall = visits[0]?.vet_name ?? null;

  const pets: FormPet[] = petRows.map((p) => {
    const members = p.pet_members
      .map((m) => ({
        id: m.user_id,
        name: m.user_id === profile.id ? "Eu" : (m.profiles?.name ?? "Outro"),
      }))
      .sort(
        (a, b) => Number(b.id === profile.id) - Number(a.id === profile.id),
      );
    const w = (weightsRes.data ?? []).find((x) => x.pet_id === p.id);
    return {
      id: p.id,
      name: p.name,
      species: p.species === "cat" ? "cat" : "dog",
      color: isPetColor(p.color) ? p.color : "laranja",
      photoUrl: p.photo_path ? (photos.get(p.photo_path) ?? null) : null,
      members,
      lastWeight: w ? { kg: Number(w.weight_kg), on: w.measured_on } : null,
      lastVet:
        visits.find((v) => v.pet_id === p.id)?.vet_name ?? lastVetOverall,
    };
  });

  const cookieStore = await cookies();
  const wanted = preferredPetId ?? cookieStore.get(LAST_PET_COOKIE)?.value;
  const initialPetId =
    pets.find((p) => p.id === wanted)?.id ?? pets[0]?.id ?? "";

  return {
    meId: profile.id,
    meName: profile.name ?? "",
    pets,
    presets: (presetsRes.data ?? []).map((r) => ({
      id: r.id,
      species: r.species === "cat" ? "cat" : "dog",
      type: r.type as FormPreset["type"],
      name: r.name,
      intervalMonths: r.interval_months,
    })),
    initialPetId,
    vets: distinct(visits.map((v) => v.vet_name)),
    products: distinct((eventsRes.data ?? []).map((e) => e.product)),
    medicines: distinct((medsRes.data ?? []).map((m) => m.name)),
  };
}
