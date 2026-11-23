"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { limitMessage } from "@/lib/limites";
import { createClient } from "@/lib/supabase/server";

import { PHOTO_MAX_BYTES, petSchema } from "./schemas";

export type PetFormState = {
  /** Mensagem por campo (nome, species, birth_date…). */
  errors?: Record<string, string>;
  message?: string;
};

async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/entrar");
  return { supabase, userId: data.claims.sub };
}

function parseForm(formData: FormData) {
  const raw: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") raw[key] = value;
  }
  const parsed = petSchema.safeParse(raw);
  if (parsed.success) {
    return { data: parsed.data, errors: undefined, message: undefined };
  }
  const errors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const key = String(issue.path[0] ?? "form");
    errors[key] ??= issue.message;
  }
  return {
    data: undefined,
    errors,
    message: "Confirma os campos assinalados.",
  };
}

function readPhoto(formData: FormData): File | null | "invalid" {
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return null;
  if (file.type !== "image/jpeg" || file.size > PHOTO_MAX_BYTES) {
    return "invalid";
  }
  return file;
}

async function uploadPhoto(
  supabase: Awaited<ReturnType<typeof createClient>>,
  petId: string,
  file: File,
): Promise<string | null> {
  const path = `${petId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage
    .from("fotos")
    .upload(path, file, { contentType: "image/jpeg", cacheControl: "3600" });
  return error ? null : path;
}

const PHOTO_ERROR = "Não conseguimos guardar a foto. Tenta outra.";

/** Ecrã 12: cria o animal (e a foto) e segue para «Criado». */
export async function createPet(
  _prev: PetFormState,
  formData: FormData,
): Promise<PetFormState> {
  const parsed = parseForm(formData);
  if (!parsed.data) return { errors: parsed.errors, message: parsed.message };
  const photo = readPhoto(formData);
  if (photo === "invalid") return { errors: { photo: PHOTO_ERROR } };

  const { supabase } = await requireUser();
  const id = crypto.randomUUID();
  const { error } = await supabase.from("pets").insert({ id, ...parsed.data });
  if (error) {
    return {
      message: limitMessage(error) ?? "Não conseguimos guardar. Tenta de novo.",
    };
  }

  if (photo) {
    const path = await uploadPhoto(supabase, id, photo);
    if (path) {
      await supabase.from("pets").update({ photo_path: path }).eq("id", id);
    }
  }

  revalidatePath("/animais");
  redirect(`/animais/${id}/criado`);
}

/** Ecrã 12 (editar): só o dono; a RLS garante-o. */
export async function updatePet(
  petId: string,
  _prev: PetFormState,
  formData: FormData,
): Promise<PetFormState> {
  const parsed = parseForm(formData);
  if (!parsed.data) return { errors: parsed.errors, message: parsed.message };
  const photo = readPhoto(formData);
  if (photo === "invalid") return { errors: { photo: PHOTO_ERROR } };

  const { supabase } = await requireUser();
  const { data: current } = await supabase
    .from("pets")
    .select("photo_path")
    .eq("id", petId)
    .single();
  if (!current) return { message: "Não conseguimos guardar. Tenta de novo." };

  let photo_path = current.photo_path;
  if (photo) {
    const path = await uploadPhoto(supabase, petId, photo);
    if (!path) return { errors: { photo: PHOTO_ERROR } };
    photo_path = path;
  } else if (formData.get("remove_photo") === "1") {
    photo_path = null;
  }

  const { data: updated, error } = await supabase
    .from("pets")
    .update({ ...parsed.data, photo_path })
    .eq("id", petId)
    .select("id");
  if (error || !updated?.length) {
    return { message: "Não conseguimos guardar. Tenta de novo." };
  }

  if (current.photo_path && current.photo_path !== photo_path) {
    await supabase.storage.from("fotos").remove([current.photo_path]);
  }

  revalidatePath("/animais");
  redirect("/animais");
}

/** Reativar (só dono). */
export async function reactivatePet(petId: string) {
  const { supabase } = await requireUser();
  const { data: memories } = await supabase
    .from("pet_memories")
    .select("photo_path")
    .eq("pet_id", petId);
  await supabase
    .from("pets")
    .update({
      archived_at: null,
      deceased_on: null,
      deceased_precision: "day",
    })
    .eq("id", petId);
  const photos = (memories ?? [])
    .map((m) => m.photo_path)
    .filter((p): p is string => !!p);
  if (photos.length) await supabase.storage.from("fotos").remove(photos);
  revalidatePath("/animais");
  redirect("/animais");
}
