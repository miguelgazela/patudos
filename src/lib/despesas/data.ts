import "server-only";

import { notFound } from "next/navigation";

import { getCurrentProfile } from "@/lib/auth/current-profile";
import { namesFor, signDocuments } from "@/lib/ficha/data";
import { isPetColor, type PetColor } from "@/lib/pets/constants";
import { signPhotos } from "@/lib/pets/data";
import { createClient } from "@/lib/supabase/server";

import { parseOverview, type Overview } from "./overview";
import type { Period } from "./period";

export type ExpenseFilters = {
  petId?: string;
  category?: string;
  paidBy?: string;
};

export type ExpensePet = {
  id: string;
  name: string;
  color: PetColor;
  species: "dog" | "cat";
  photoUrl: string | null;
};

export type Payer = { id: string; name: string };

export type ExpensesPage = {
  meId: string;
  pets: ExpensePet[];
  /** Quem pode ter pago: eu e quem partilha animais comigo. */
  payers: Payer[];
  overview: Overview;
};

/** Ecrã 25: tudo o que o resumo precisa (as somas fazem-se na BD, com RLS). */
export async function getExpensesPage(
  period: Period,
  filters: ExpenseFilters,
): Promise<ExpensesPage> {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const [petsRes, overviewRes] = await Promise.all([
    supabase
      .from("pets")
      .select(
        "id, name, species, color, photo_path, pet_members(user_id, profiles(name))",
      )
      .order("created_at", { ascending: true }),
    supabase.rpc("expense_overview", {
      p_from: period.from,
      p_to: period.to,
      ...(filters.petId ? { p_pet_id: filters.petId } : {}),
      ...(filters.category ? { p_category: filters.category } : {}),
      ...(filters.paidBy ? { p_paid_by: filters.paidBy } : {}),
    }),
  ]);
  if (overviewRes.error) throw new Error("expense_overview");

  const petRows = petsRes.data ?? [];
  const photos = await signPhotos(
    supabase,
    petRows.map((p) => p.photo_path),
  );
  const pets: ExpensePet[] = petRows.map((p) => ({
    id: p.id,
    name: p.name,
    species: p.species === "cat" ? "cat" : "dog",
    color: isPetColor(p.color) ? p.color : "laranja",
    photoUrl: p.photo_path ? (photos.get(p.photo_path) ?? null) : null,
  }));

  const payers = new Map<string, string>([[profile.id, "Eu"]]);
  for (const p of petRows) {
    for (const m of p.pet_members) {
      if (!payers.has(m.user_id)) {
        payers.set(m.user_id, m.profiles?.name?.trim() || "Outra pessoa");
      }
    }
  }

  return {
    meId: profile.id,
    pets,
    payers: [...payers].map(([id, name]) => ({ id, name })),
    overview: parseOverview(overviewRes.data),
  };
}

export type ExpenseDetail = {
  id: string;
  amountCents: number;
  category: string;
  spentOn: string;
  description: string | null;
  paidBy: string | null;
  paidByName: string | null;
  createdByName: string | null;
  visitHref: string | null;
  document: { id: string; url: string | null } | null;
  /** Só os splits que o utilizador vê. */
  splits: { petId: string; cents: number }[];
  /** Há partes de outros animais (que não vê): o total e os animais não se editam aqui. */
  hasHiddenParts: boolean;
  canEdit: boolean;
};

/** Ecrã 26 em edição (404 se não existir ou não houver acesso). */
export async function getExpenseDetail(id: string): Promise<ExpenseDetail> {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: e } = await supabase
    .from("expenses")
    .select(
      "id, amount_cents, category, spent_on, description, paid_by, vet_visit_id, document_id, created_by",
    )
    .eq("id", id)
    .maybeSingle();
  if (!e) notFound();

  const [splitsRes, canEditRes, hiddenRes, visitRes, docRes] =
    await Promise.all([
      supabase
        .from("expense_splits")
        .select("pet_id, amount_cents")
        .eq("expense_id", id)
        .order("amount_cents", { ascending: false }),
      supabase.rpc("can_edit_expense", { p_expense_id: id }),
      supabase.rpc("expense_hidden_cents", { p_expense_id: id }),
      e.vet_visit_id
        ? supabase
            .from("vet_visits")
            .select("id, pet_id")
            .eq("id", e.vet_visit_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      e.document_id
        ? supabase
            .from("documents")
            .select("id, storage_path")
            .eq("id", e.document_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const doc = docRes.data;
  const [names, urls] = await Promise.all([
    namesFor(supabase, [e.paid_by, e.created_by], profile.id),
    doc ? signDocuments(supabase, [doc]) : Promise.resolve(new Map()),
  ]);

  return {
    id: e.id,
    amountCents: e.amount_cents,
    category: e.category,
    spentOn: e.spent_on,
    description: e.description,
    paidBy: e.paid_by,
    paidByName: e.paid_by ? (names.get(e.paid_by) ?? "outra pessoa") : null,
    createdByName: e.created_by
      ? (names.get(e.created_by) ?? "outra pessoa")
      : null,
    visitHref: visitRes.data
      ? `/animais/${visitRes.data.pet_id}/consulta/${visitRes.data.id}`
      : null,
    document: doc ? { id: doc.id, url: urls.get(doc.id) ?? null } : null,
    splits: (splitsRes.data ?? []).map((s) => ({
      petId: s.pet_id,
      cents: s.amount_cents,
    })),
    hasHiddenParts: Number(hiddenRes.data ?? 0) > 0,
    canEdit: canEditRes.data === true,
  };
}
