import type { Json } from "@/lib/database.types";

export type OverviewItem = {
  id: string;
  spentOn: string;
  category: string;
  description: string | null;
  paidBy: string | null;
  vetVisitId: string | null;
  /** Soma dos splits que o utilizador vê (é o que entra nos totais). */
  amountCents: number;
  /** Total da despesa (pode incluir partes de animais que o utilizador não vê). */
  totalCents: number;
  pets: { petId: string; cents: number }[];
};

export type Overview = {
  totalCents: number;
  byPet: { petId: string; cents: number }[];
  byCategory: { category: string; cents: number }[];
  byPayer: { paidBy: string | null; cents: number }[];
  items: OverviewItem[];
};

type Obj = Record<string, Json | undefined>;
const arr = (v: Json | undefined): Obj[] =>
  Array.isArray(v) ? (v as Obj[]) : [];
const num = (v: Json | undefined) => Number(v ?? 0);
const str = (v: Json | undefined) => (typeof v === "string" ? v : null);

/** Resposta da RPC `expense_overview` → tipos da app. */
export function parseOverview(json: Json | null): Overview {
  const o = (json ?? {}) as Obj;
  return {
    totalCents: num(o.total_cents),
    byPet: arr(o.by_pet).map((r) => ({
      petId: String(r.pet_id),
      cents: num(r.amount_cents),
    })),
    byCategory: arr(o.by_category).map((r) => ({
      category: String(r.category),
      cents: num(r.amount_cents),
    })),
    byPayer: arr(o.by_payer).map((r) => ({
      paidBy: str(r.paid_by),
      cents: num(r.amount_cents),
    })),
    items: arr(o.items).map((r) => ({
      id: String(r.id),
      spentOn: String(r.spent_on),
      category: String(r.category),
      description: str(r.description),
      paidBy: str(r.paid_by),
      vetVisitId: str(r.vet_visit_id),
      amountCents: num(r.amount_cents),
      totalCents: num(r.total_cents),
      pets: arr(r.pets).map((p) => ({
        petId: String(p.pet_id),
        cents: num(p.amount_cents),
      })),
    })),
  };
}
