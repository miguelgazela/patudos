"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { limitMessage } from "@/lib/limites";
import { createClient } from "@/lib/supabase/server";

import { nextFreeColor, type Species } from "./constants";
import { lisbonToday } from "./age";
import { usedColors } from "./data";
import { PHOTO_MAX_BYTES } from "./schemas";
import { SPECIES } from "./constants";
import {
  MEMORY_MAX,
  TRIBUTE_TEXT_MAX,
  isBeforeBirth,
  type Precision,
  parseOptionalText,
  parsePartialDate,
} from "./tribute";

export type TributeState = {
  errors?: Record<string, string>;
  message?: string;
  /** Gravado sem sair do ecrã (painéis). */
  ok?: boolean;
};

const SAVE_ERROR = "Não conseguimos guardar. Tenta de novo.";
const PHOTO_ERROR = "Não conseguimos guardar a foto. Tenta outra.";
const TEXT_ERROR = `O texto é grande demais. Usa até ${TRIBUTE_TEXT_MAX} letras.`;

type Client = Awaited<ReturnType<typeof createClient>>;

async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/entrar");
  return { supabase, userId: data.claims.sub };
}

function str(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

function readPhoto(formData: FormData): File | null | "invalid" {
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return null;
  if (file.type !== "image/jpeg" || file.size > PHOTO_MAX_BYTES) {
    return "invalid";
  }
  return file;
}

async function upload(
  supabase: Client,
  path: string,
  file: File,
): Promise<boolean> {
  const { error } = await supabase.storage
    .from("fotos")
    .upload(path, file, { contentType: "image/jpeg", cacheControl: "3600" });
  return !error;
}

/** Data de falecimento do formulário (`deceased_on` + `deceased_on_precision`). */
function readDeceased(
  formData: FormData,
  birthDate: string | null,
): { error: string } | { date: string; precision: Precision } {
  const parsed = parsePartialDate(
    str(formData, "deceased_on"),
    str(formData, "deceased_on_precision"),
    lisbonToday(),
  );
  if (!parsed.ok) return { error: parsed.message };
  if (birthDate && isBeforeBirth(birthDate, parsed.date, parsed.precision)) {
    return {
      error: "O falecimento não pode ser antes do nascimento.",
    };
  }
  return { date: parsed.date, precision: parsed.precision };
}

/** Arquivar (só dono): «Faleceu» (com data, e passa a ter tributo) ou «Já não está comigo». */
export async function archivePet(
  petId: string,
  _prev: TributeState,
  formData: FormData,
): Promise<TributeState> {
  const { supabase } = await requireUser();
  const reason = str(formData, "reason");
  if (reason !== "deceased" && reason !== "other") {
    return { errors: { reason: "Escolhe o motivo." } };
  }
  const deceased = reason === "deceased";

  let patch: {
    archived_at: string;
    deceased_on?: string;
    deceased_precision?: string;
  } = { archived_at: new Date().toISOString() };

  if (deceased) {
    const { data: pet } = await supabase
      .from("pets")
      .select("birth_date")
      .eq("id", petId)
      .maybeSingle();
    const d = readDeceased(formData, pet?.birth_date ?? null);
    if ("error" in d) return { errors: { deceased_on: d.error } };
    patch = {
      ...patch,
      deceased_on: d.date,
      deceased_precision: d.precision,
    };
  }

  const { data, error } = await supabase
    .from("pets")
    .update(patch)
    .eq("id", petId)
    .select("id");
  if (error || !data?.length) return { message: SAVE_ERROR };

  revalidatePath("/animais");
  redirect(deceased ? `/animais/${petId}/tributo` : "/animais");
}

/** «Em memória de…»: cria logo um animal que já faleceu (arquivado, com tributo). */
export async function createMemorialPet(
  _prev: TributeState,
  formData: FormData,
): Promise<TributeState> {
  const errors: Record<string, string> = {};

  const name = str(formData, "name").trim();
  if (!name) errors.name = "Escreve o nome.";
  else if (name.length > 40) {
    errors.name = "O nome é demasiado grande. Usa até 40 letras.";
  }

  const species = str(formData, "species");
  if (!(SPECIES as readonly string[]).includes(species)) {
    errors.species = "Escolhe se era cão ou gato.";
  }

  const today = lisbonToday();
  let birth: { date: string; estimate: boolean } | null = null;
  if (str(formData, "birth_on").trim() !== "") {
    const b = parsePartialDate(
      str(formData, "birth_on"),
      str(formData, "birth_on_precision"),
      today,
    );
    if (!b.ok) errors.birth_on = b.message;
    else birth = { date: b.date, estimate: b.precision !== "day" };
  }

  const d = readDeceased(formData, birth?.date ?? null);
  if ("error" in d) errors.deceased_on = d.error;

  const text = parseOptionalText(
    formData.get("tribute_text")?.toString(),
    TRIBUTE_TEXT_MAX,
    TEXT_ERROR,
  );
  if (!text.ok) errors.tribute_text = text.message;

  const photo = readPhoto(formData);
  if (photo === "invalid") errors.photo = PHOTO_ERROR;

  if (
    Object.keys(errors).length ||
    "error" in d ||
    !text.ok ||
    photo === "invalid"
  ) {
    return { errors, message: "Confirma os campos assinalados." };
  }

  const { supabase } = await requireUser();
  const id = crypto.randomUUID();
  const { error } = await supabase.from("pets").insert({
    id,
    name,
    species: species as Species,
    color: nextFreeColor(await usedColors()),
    birth_date: birth?.date ?? null,
    birth_date_is_estimate: birth?.estimate ?? false,
    archived_at: new Date().toISOString(),
    deceased_on: d.date,
    deceased_precision: d.precision,
    tribute_text: text.value,
  });
  if (error) return { message: limitMessage(error) ?? SAVE_ERROR };

  if (photo) {
    const path = `${id}/${crypto.randomUUID()}.jpg`;
    if (await upload(supabase, path, photo)) {
      await supabase.from("pets").update({ photo_path: path }).eq("id", id);
    }
  }

  revalidatePath("/animais");
  redirect(`/animais/${id}/tributo`);
}

/** Editar o tributo (só dono): data do falecimento e texto. */
export async function updateTribute(
  petId: string,
  _prev: TributeState,
  formData: FormData,
): Promise<TributeState> {
  const { supabase } = await requireUser();
  const { data: pet } = await supabase
    .from("pets")
    .select("birth_date")
    .eq("id", petId)
    .maybeSingle();
  if (!pet) return { message: SAVE_ERROR };

  const errors: Record<string, string> = {};
  const d = readDeceased(formData, pet.birth_date);
  if ("error" in d) errors.deceased_on = d.error;
  const text = parseOptionalText(
    formData.get("tribute_text")?.toString(),
    TRIBUTE_TEXT_MAX,
    TEXT_ERROR,
  );
  if (!text.ok) errors.tribute_text = text.message;
  if ("error" in d || !text.ok) return { errors };

  const { data, error } = await supabase
    .from("pets")
    .update({
      deceased_on: d.date,
      deceased_precision: d.precision,
      tribute_text: text.value,
    })
    .eq("id", petId)
    .select("id");
  if (error || !data?.length) return { message: SAVE_ERROR };

  revalidatePath(`/animais/${petId}/tributo`);
  revalidatePath("/animais");
  redirect(`/animais/${petId}/tributo`);
}

function readBody(formData: FormData): { body: string } | { error: string } {
  const body = str(formData, "body").trim();
  if (!body) return { error: "Escreve a memória." };
  if (body.length > MEMORY_MAX) {
    return {
      error: `A memória é grande demais. Usa até ${MEMORY_MAX} letras.`,
    };
  }
  return { body };
}

/** Deixar uma memória (dono ou cuidador). */
export async function addMemory(
  petId: string,
  _prev: TributeState,
  formData: FormData,
): Promise<TributeState> {
  const b = readBody(formData);
  if ("error" in b) return { errors: { body: b.error } };
  const photo = readPhoto(formData);
  if (photo === "invalid") return { errors: { photo: PHOTO_ERROR } };

  const { supabase } = await requireUser();
  let photo_path: string | null = null;
  if (photo) {
    photo_path = `${petId}/memorias/${crypto.randomUUID()}.jpg`;
    if (!(await upload(supabase, photo_path, photo))) {
      return { errors: { photo: PHOTO_ERROR } };
    }
  }

  const { error } = await supabase
    .from("pet_memories")
    .insert({ pet_id: petId, body: b.body, photo_path });
  if (error) {
    if (photo_path) await supabase.storage.from("fotos").remove([photo_path]);
    return { message: limitMessage(error) ?? SAVE_ERROR };
  }

  revalidatePath(`/animais/${petId}/tributo`);
  return { ok: true };
}

/** Editar a minha memória (texto e foto). */
export async function updateMemory(
  memoryId: string,
  _prev: TributeState,
  formData: FormData,
): Promise<TributeState> {
  const b = readBody(formData);
  if ("error" in b) return { errors: { body: b.error } };
  const photo = readPhoto(formData);
  if (photo === "invalid") return { errors: { photo: PHOTO_ERROR } };

  const { supabase } = await requireUser();
  const { data: current } = await supabase
    .from("pet_memories")
    .select("pet_id, photo_path")
    .eq("id", memoryId)
    .maybeSingle();
  if (!current) return { message: SAVE_ERROR };

  let photo_path = current.photo_path;
  if (photo) {
    const path = `${current.pet_id}/memorias/${crypto.randomUUID()}.jpg`;
    if (!(await upload(supabase, path, photo))) {
      return { errors: { photo: PHOTO_ERROR } };
    }
    photo_path = path;
  } else if (formData.get("remove_photo") === "1") {
    photo_path = null;
  }

  const { data, error } = await supabase
    .from("pet_memories")
    .update({ body: b.body, photo_path })
    .eq("id", memoryId)
    .select("id");
  if (error || !data?.length) {
    if (photo_path && photo_path !== current.photo_path) {
      await supabase.storage.from("fotos").remove([photo_path]);
    }
    return { message: limitMessage(error ?? {}) ?? SAVE_ERROR };
  }

  if (current.photo_path && current.photo_path !== photo_path) {
    await supabase.storage.from("fotos").remove([current.photo_path]);
  }
  revalidatePath(`/animais/${current.pet_id}/tributo`);
  return { ok: true };
}

/** Apagar uma memória (a minha, ou qualquer uma se for dono). */
export async function deleteMemory(memoryId: string): Promise<{ ok: boolean }> {
  const { supabase } = await requireUser();
  const { data: current } = await supabase
    .from("pet_memories")
    .select("pet_id, photo_path")
    .eq("id", memoryId)
    .maybeSingle();
  if (!current) return { ok: false };

  const { data, error } = await supabase
    .from("pet_memories")
    .delete()
    .eq("id", memoryId)
    .select("id");
  if (error || !data?.length) return { ok: false };

  if (current.photo_path) {
    await supabase.storage.from("fotos").remove([current.photo_path]);
  }
  revalidatePath(`/animais/${current.pet_id}/tributo`);
  return { ok: true };
}

/** «Afinal não faleceu» (só dono): o animal volta à lista e as memórias apagam-se (a BD apaga as linhas). */
export async function undoDeceased(petId: string): Promise<{ ok: boolean }> {
  const { supabase } = await requireUser();
  const { data: memories } = await supabase
    .from("pet_memories")
    .select("photo_path")
    .eq("pet_id", petId);

  const { data, error } = await supabase
    .from("pets")
    .update({ archived_at: null, deceased_on: null, deceased_precision: "day" })
    .eq("id", petId)
    .select("id");
  if (error || !data?.length) {
    return { ok: false };
  }

  const photos = (memories ?? [])
    .map((m) => m.photo_path)
    .filter((p): p is string => !!p);
  if (photos.length) await supabase.storage.from("fotos").remove(photos);

  revalidatePath("/animais");
  redirect(`/animais/${petId}`);
}
