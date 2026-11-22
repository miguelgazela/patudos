import "server-only";

import { notFound } from "next/navigation";
import { z } from "zod";

import { getCurrentProfile } from "@/lib/auth/current-profile";
import { namesFor } from "@/lib/ficha/data";
import { createClient } from "@/lib/supabase/server";

import type { ListedDocument } from "./logic";

/** Validade das URLs assinadas dos documentos (curta; o partilhar pede uma nova). */
export const DOCUMENT_URL_SECONDS = 30 * 60;

export function isImagePath(path: string): boolean {
  return /\.(jpe?g|png|webp|heic)$/i.test(path);
}

export type DocumentListItem = ListedDocument & {
  /** Miniatura (só imagens): URL assinada da própria imagem. */
  thumbUrl: string | null;
  isImage: boolean;
};

/**
 * Documentos dos animais a que o utilizador tem acesso (RLS), do mais recente
 * para o mais antigo. Com `petId`, só os desse animal.
 *
 * Miniaturas: o Supabase só redimensiona (`transform`) em planos pagos; sem isso o
 * URL falharia. As imagens já vêm comprimidas (≤ 2048 px) e a grelha carrega-as em lazy.
 */
export async function listDocuments(
  petId?: string,
): Promise<DocumentListItem[]> {
  const supabase = await createClient();
  let q = supabase
    .from("documents")
    .select(
      "id, pet_id, kind, title, document_date, storage_path, created_at, pets(name)",
    )
    .order("document_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (petId) q = q.eq("pet_id", petId);
  const { data } = await q;
  const docs = data ?? [];

  const images = docs.filter((d) => isImagePath(d.storage_path));
  const urls = new Map<string, string>();
  if (images.length) {
    const signed = await supabase.storage.from("documentos").createSignedUrls(
      images.map((d) => d.storage_path),
      DOCUMENT_URL_SECONDS,
    );
    for (const s of signed.data ?? []) {
      if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
    }
  }

  return docs.map((d) => ({
    id: d.id,
    petId: d.pet_id,
    petName: d.pets?.name ?? "",
    kind: d.kind,
    title: d.title,
    date: d.document_date ?? d.created_at.slice(0, 10),
    isImage: isImagePath(d.storage_path),
    thumbUrl: urls.get(d.storage_path) ?? null,
  }));
}

export type DocumentDetail = {
  id: string;
  petId: string;
  petName: string;
  kind: string;
  title: string;
  date: string;
  mimeType: string | null;
  isPdf: boolean;
  url: string | null;
  addedBy: string | null;
  canEdit: boolean;
  visit: { href: string; label: string } | null;
  expense: { href: string; cents: number } | null;
};

/** Ecrã 28 (404 se não existir ou não houver acesso). */
export async function getDocumentDetail(id: string): Promise<DocumentDetail> {
  if (!z.uuid().safeParse(id).success) notFound();
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: d } = await supabase
    .from("documents")
    .select(
      "id, pet_id, kind, title, document_date, storage_path, mime_type, vet_visit_id, created_by, created_at, pets(name)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!d) notFound();

  const [signed, memberRes, visitRes, expenseRes] = await Promise.all([
    supabase.storage
      .from("documentos")
      .createSignedUrl(d.storage_path, DOCUMENT_URL_SECONDS),
    supabase
      .from("pet_members")
      .select("role")
      .eq("pet_id", d.pet_id)
      .eq("user_id", profile.id)
      .maybeSingle(),
    d.vet_visit_id
      ? supabase
          .from("vet_visits")
          .select("id, visited_on, reason")
          .eq("id", d.vet_visit_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("expenses")
      .select("id, amount_cents, expense_splits(pet_id, amount_cents)")
      .eq("document_id", d.id)
      .limit(1)
      .maybeSingle(),
  ]);
  const names = await namesFor(supabase, [d.created_by], profile.id);

  const petName = d.pets?.name ?? "";
  const visit = visitRes.data;
  const expense = expenseRes.data;
  const myCents = expense
    ? expense.expense_splits.reduce((s, x) => s + x.amount_cents, 0)
    : 0;

  return {
    id: d.id,
    petId: d.pet_id,
    petName,
    kind: d.kind,
    title: d.title,
    date: d.document_date ?? d.created_at.slice(0, 10),
    mimeType: d.mime_type,
    isPdf: d.mime_type === "application/pdf" || /\.pdf$/i.test(d.storage_path),
    url: signed.data?.signedUrl ?? null,
    addedBy: d.created_by ? (names.get(d.created_by) ?? "outra pessoa") : null,
    canEdit: memberRes.data?.role === "owner" || d.created_by === profile.id,
    visit: visit
      ? {
          href: `/animais/${d.pet_id}/consulta/${visit.id}`,
          label: `Consulta${petName ? ` de ${petName}` : ""}${visit.reason ? ` · ${visit.reason}` : ""}`,
        }
      : null,
    expense: expense
      ? {
          href: `/despesas/${expense.id}`,
          cents: myCents || expense.amount_cents,
        }
      : null,
  };
}
