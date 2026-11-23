"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { limitMessage } from "@/lib/limites";
import { createClient } from "@/lib/supabase/server";
import { LAST_PET_COOKIE } from "@/lib/vet-visits/data";

import { createDocumentSchema, updateDocumentSchema } from "./schema";

export type DocumentResult =
  | { ok: true; id: string; petId?: string }
  | { ok: false; message: string; errors?: Record<string, string> };

const GENERIC =
  "Não conseguimos guardar. Os dados continuam aqui; tenta de novo.";

async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/entrar");
  return supabase;
}

function fieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    errors[issue.path.join(".") || "form"] ??= issue.message;
  }
  return errors;
}

/**
 * Ecrã 27: o ficheiro já está em `documentos/{pet_id}/…` (upload direto do cliente);
 * aqui grava-se a linha. Se falhar, apaga-se o ficheiro para não ficar órfão.
 */
export async function createDocument(input: unknown): Promise<DocumentResult> {
  const parsed = createDocumentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Confirma os campos assinalados.",
      errors: fieldErrors(parsed.error),
    };
  }
  const v = parsed.data;
  const supabase = await requireUser();
  const { data, error } = await supabase
    .from("documents")
    .insert({
      pet_id: v.petId,
      kind: v.kind,
      title: v.title,
      storage_path: v.storagePath,
      mime_type: v.mimeType,
      document_date: v.date,
    })
    .select("id")
    .single();
  if (error || !data) {
    await supabase.storage.from("documentos").remove([v.storagePath]);
    return { ok: false, message: (error && limitMessage(error)) || GENERIC };
  }

  (await cookies()).set(LAST_PET_COOKIE, v.petId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/documentos");
  revalidatePath(`/animais/${v.petId}`, "layout");
  return { ok: true, id: data.id, petId: v.petId };
}

/** Ecrã 28 · Editar dados (RLS: dono do animal ou quem carregou). */
export async function updateDocument(input: unknown): Promise<DocumentResult> {
  const parsed = updateDocumentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Confirma os campos assinalados.",
      errors: fieldErrors(parsed.error),
    };
  }
  const v = parsed.data;
  const supabase = await requireUser();
  const { data, error } = await supabase
    .from("documents")
    .update({ kind: v.kind, title: v.title, document_date: v.date })
    .eq("id", v.id)
    .select("id, pet_id");
  const row = data?.[0];
  if (error || !row) {
    return {
      ok: false,
      message: error
        ? GENERIC
        : "Só quem carregou o documento ou o dono do animal o pode editar.",
    };
  }
  revalidatePath("/documentos");
  revalidatePath(`/documentos/${v.id}`);
  revalidatePath(`/animais/${row.pet_id}`, "layout");
  return { ok: true, id: row.id, petId: row.pet_id };
}

/**
 * Apaga o documento e o ficheiro. As despesas (`document_id`) e o anexo da consulta
 * (`vet_visit_id`) ficam sem a ligação: as chaves são `on delete set null`.
 */
export async function deleteDocument(id: string): Promise<DocumentResult> {
  if (!z.uuid().safeParse(id).success) return { ok: false, message: GENERIC };
  const supabase = await requireUser();
  const { data: doc } = await supabase
    .from("documents")
    .select("id, pet_id, storage_path")
    .eq("id", id)
    .maybeSingle();
  if (!doc) {
    return { ok: false, message: "Este documento já não existe." };
  }
  const { data, error } = await supabase
    .from("documents")
    .delete()
    .eq("id", id)
    .select("id");
  if (error || !data?.[0]) {
    return {
      ok: false,
      message: error
        ? GENERIC
        : "Só quem carregou o documento ou o dono do animal o pode apagar.",
    };
  }
  // A linha já foi apagada; o ficheiro segue as mesmas permissões (dono ou quem carregou).
  await supabase.storage.from("documentos").remove([doc.storage_path]);
  revalidatePath("/documentos");
  revalidatePath("/despesas");
  revalidatePath(`/animais/${doc.pet_id}`, "layout");
  return { ok: true, id, petId: doc.pet_id };
}

/** URL nova e curta (5 min) para partilhar/descarregar sem depender da que veio na página. */
export async function signDocumentUrl(
  id: string,
): Promise<{ ok: true; url: string } | { ok: false }> {
  if (!z.uuid().safeParse(id).success) return { ok: false };
  const supabase = await requireUser();
  const { data: doc } = await supabase
    .from("documents")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();
  if (!doc) return { ok: false };
  const signed = await supabase.storage
    .from("documentos")
    .createSignedUrl(doc.storage_path, 300);
  return signed.data?.signedUrl
    ? { ok: true, url: signed.data.signedUrl }
    : { ok: false };
}
