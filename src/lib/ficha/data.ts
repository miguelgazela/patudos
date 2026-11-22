import "server-only";

import { notFound } from "next/navigation";
import { cache } from "react";

import { getCurrentProfile } from "@/lib/auth/current-profile";
import { formatISODate } from "@/lib/dates";
import { formatAge } from "@/lib/pets/age";
import { isPetColor, type PetColor } from "@/lib/pets/constants";
import { signPhotos } from "@/lib/pets/data";
import { createClient } from "@/lib/supabase/server";
import { formatKg } from "@/lib/units";
import { describeRRule } from "@/lib/vet-visits/schedule";

import { eventTypeLabel } from "./labels";
import {
  buildTimeline,
  type RawDocument,
  type RawEvent,
  type RawExpense,
  type RawMedication,
  type RawVisit,
  type RawWeight,
  type TimelineEntry,
} from "./timeline";

type Client = Awaited<ReturnType<typeof createClient>>;

export type PetPerson = {
  id: string;
  name: string;
  role: "owner" | "caregiver";
};

export type PetHeader = {
  id: string;
  name: string;
  species: string;
  sex: string | null;
  breed: string | null;
  color: PetColor;
  age: string | null;
  neutered: boolean | null;
  microchip: string | null;
  photoUrl: string | null;
  people: PetPerson[];
  meId: string;
  isOwner: boolean;
};

/** Cabeçalho da ficha (partilhado pelo layout e pelas páginas; 404 se não houver acesso). */
export const getPetHeader = cache(async (petId: string): Promise<PetHeader> => {
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const { data: pet } = await supabase
    .from("pets")
    .select(
      "id, name, species, sex, breed, color, birth_date, neutered, microchip, photo_path, pet_members(user_id, role, profiles(name))",
    )
    .eq("id", petId)
    .maybeSingle();
  if (!pet) notFound();

  const photos = await signPhotos(supabase, [pet.photo_path]);
  const people: PetPerson[] = pet.pet_members
    .map((m) => ({
      id: m.user_id,
      name: m.profiles?.name?.trim() || "Alguém",
      role: (m.role === "owner" ? "owner" : "caregiver") as PetPerson["role"],
    }))
    .sort(
      (a, b) =>
        Number(b.role === "owner") - Number(a.role === "owner") ||
        a.name.localeCompare(b.name, "pt"),
    );

  return {
    id: pet.id,
    name: pet.name,
    species: pet.species,
    sex: pet.sex,
    breed: pet.breed,
    color: isPetColor(pet.color) ? pet.color : "laranja",
    age: pet.birth_date ? formatAge(pet.birth_date) : null,
    neutered: pet.neutered,
    microchip: pet.microchip,
    photoUrl: pet.photo_path ? (photos.get(pet.photo_path) ?? null) : null,
    people,
    meId: profile.id,
    isOwner: people.some((p) => p.id === profile.id && p.role === "owner"),
  };
});

/** Nomes (perfis visíveis) por id; quem já não é visível fica de fora. */
export async function namesFor(
  supabase: Client,
  ids: (string | null)[],
  meId: string,
): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((i): i is string => !!i))];
  const names = new Map<string, string>();
  if (!unique.length) return names;
  const { data } = await supabase
    .from("profiles")
    .select("id, name")
    .in("id", unique);
  for (const p of data ?? []) {
    if (p.name?.trim()) names.set(p.id, p.name.trim());
  }
  if (names.has(meId)) names.set(meId, "ti");
  return names;
}

/** URLs assinadas (1 h) do bucket privado «documentos». */
export async function signDocuments(
  supabase: Client,
  docs: { id: string; storage_path: string }[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!docs.length) return map;
  const { data } = await supabase.storage.from("documentos").createSignedUrls(
    docs.map((d) => d.storage_path),
    3600,
  );
  const byPath = new Map(
    (data ?? []).map((i) => [i.path, i.signedUrl] as const),
  );
  for (const d of docs) {
    const url = byPath.get(d.storage_path);
    if (url) map.set(d.id, url);
  }
  return map;
}

export async function getTimeline(petId: string): Promise<TimelineEntry[]> {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const [visits, events, meds, weights, splits, docs] = await Promise.all([
    supabase
      .from("vet_visits")
      .select("id, visited_on, reason, vet_name, created_by, created_at")
      .eq("pet_id", petId),
    supabase
      .from("health_events")
      .select(
        "id, type, title, product, occurred_on, vet_visit_id, created_by, created_at",
      )
      .eq("pet_id", petId),
    supabase
      .from("medications")
      .select(
        "id, name, dose, schedule_rrule, starts_on, vet_visit_id, created_by, created_at",
      )
      .eq("pet_id", petId),
    supabase
      .from("weights")
      .select(
        "id, measured_on, weight_kg, vet_visit_id, created_by, created_at",
      )
      .eq("pet_id", petId),
    supabase
      .from("expense_splits")
      .select(
        "amount_cents, expenses(id, spent_on, category, amount_cents, description, vet_visit_id, created_by, created_at)",
      )
      .eq("pet_id", petId),
    supabase
      .from("documents")
      .select(
        "id, kind, title, document_date, vet_visit_id, created_by, created_at",
      )
      .eq("pet_id", petId),
  ]);

  // Despesa de uma consulta (ou de um tratamento) com este animal: mostra a parte dele.
  const expenses: RawExpense[] = (splits.data ?? []).flatMap((s) =>
    s.expenses ? [{ ...s.expenses, amount_cents: s.amount_cents }] : [],
  );
  const documents = (docs.data ?? []) as RawDocument[];

  const raw = {
    petId,
    visits: (visits.data ?? []) as RawVisit[],
    events: (events.data ?? []) as RawEvent[],
    medications: (meds.data ?? []) as RawMedication[],
    weights: (weights.data ?? []).map((w) => ({
      ...w,
      weight_kg: Number(w.weight_kg),
    })) as RawWeight[],
    expenses,
    documents,
  };
  const names = await namesFor(
    supabase,
    [
      ...raw.visits,
      ...raw.events,
      ...raw.medications,
      ...raw.weights,
      ...raw.expenses,
      ...raw.documents,
    ].map((r) => r.created_by),
    profile.id,
  );

  return buildTimeline({ ...raw, names });
}

export type SummaryData = {
  events: {
    id: string;
    type: string;
    title: string;
    occurred_on: string;
    next_due_on: string | null;
  }[];
  medications: {
    id: string;
    name: string;
    dose: string | null;
    schedule_rrule: string | null;
    ends_on: string | null;
  }[];
  weights: { id: string; on: string; kg: number }[];
  lastVisit: {
    id: string;
    visited_on: string;
    reason: string | null;
    vet_name: string | null;
    createdByName: string | null;
  } | null;
};

export async function getSummary(
  petId: string,
  today: string,
): Promise<SummaryData> {
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const [events, meds, weights, visit] = await Promise.all([
    supabase
      .from("health_events")
      .select("id, type, title, occurred_on, next_due_on")
      .eq("pet_id", petId)
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("medications")
      .select("id, name, dose, schedule_rrule, ends_on")
      .eq("pet_id", petId)
      .or(`ends_on.is.null,ends_on.gte.${today}`)
      .order("starts_on", { ascending: false }),
    supabase
      .from("weights")
      .select("id, measured_on, weight_kg")
      .eq("pet_id", petId)
      .order("measured_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("vet_visits")
      .select("id, visited_on, reason, vet_name, created_by")
      .eq("pet_id", petId)
      .order("visited_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const v = visit.data;
  const names = await namesFor(supabase, [v?.created_by ?? null], profile.id);
  return {
    events: events.data ?? [],
    medications: meds.data ?? [],
    weights: (weights.data ?? [])
      .map((w) => ({ id: w.id, on: w.measured_on, kg: Number(w.weight_kg) }))
      .reverse(),
    lastVisit: v
      ? {
          id: v.id,
          visited_on: v.visited_on,
          reason: v.reason,
          vet_name: v.vet_name,
          createdByName: v.created_by
            ? (names.get(v.created_by) ?? null)
            : null,
        }
      : null,
  };
}

export type WeightRow = {
  id: string;
  on: string;
  kg: number;
  inVisit: boolean;
};

export async function getWeights(petId: string): Promise<WeightRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("weights")
    .select("id, measured_on, weight_kg, vet_visit_id, created_at")
    .eq("pet_id", petId)
    .order("measured_on", { ascending: false })
    .order("created_at", { ascending: false });
  return (data ?? []).map((w) => ({
    id: w.id,
    on: w.measured_on,
    kg: Number(w.weight_kg),
    inVisit: !!w.vet_visit_id,
  }));
}

/** Pode este utilizador editar/apagar um registo (dono, ou quem o criou)? */
export function canEditRecord(
  head: Pick<PetHeader, "isOwner" | "meId">,
  createdBy: string | null,
): boolean {
  return head.isOwner || createdBy === head.meId;
}

export async function getVisitDetail(petId: string, visitId: string) {
  const head = await getPetHeader(petId);
  const supabase = await createClient();
  const { data: visit } = await supabase
    .from("vet_visits")
    .select(
      "id, pet_id, visited_on, reason, vet_name, clinic, notes, created_by, created_at",
    )
    .eq("id", visitId)
    .eq("pet_id", petId)
    .maybeSingle();
  if (!visit) notFound();

  const [events, meds, weights, expenses, docs] = await Promise.all([
    supabase
      .from("health_events")
      .select("id, type, title, product, next_due_on")
      .eq("vet_visit_id", visitId)
      .order("created_at"),
    supabase
      .from("medications")
      .select("id, name, dose, schedule_rrule, starts_on, ends_on")
      .eq("vet_visit_id", visitId)
      .order("created_at"),
    supabase
      .from("weights")
      .select("id, weight_kg")
      .eq("vet_visit_id", visitId),
    supabase
      .from("expenses")
      .select("id, amount_cents, description, paid_by")
      .eq("vet_visit_id", visitId),
    supabase
      .from("documents")
      .select("id, title, kind, storage_path")
      .eq("vet_visit_id", visitId)
      .order("created_at"),
  ]);
  const expense = expenses.data?.[0] ?? null;
  const names = await namesFor(
    supabase,
    [visit.created_by, expense?.paid_by ?? null],
    head.meId,
  );

  return {
    head,
    visit,
    createdByName: visit.created_by
      ? (names.get(visit.created_by) ?? "outra pessoa")
      : "outra pessoa",
    events: events.data ?? [],
    medications: meds.data ?? [],
    weight: weights.data?.[0] ? Number(weights.data[0].weight_kg) : null,
    weightId: weights.data?.[0]?.id ?? null,
    expense,
    paidByName: expense?.paid_by
      ? (names.get(expense.paid_by) ?? "outra pessoa")
      : null,
    documents: (docs.data ?? []).map((d) => ({
      id: d.id,
      title: d.title,
      kind: d.kind,
    })),
    canEdit: canEditRecord(head, visit.created_by),
  };
}

export const RECORD_KINDS = ["evento", "medicacao", "peso"] as const;
export type RecordKind = (typeof RECORD_KINDS)[number];

export function isRecordKind(value: string): value is RecordKind {
  return (RECORD_KINDS as readonly string[]).includes(value);
}

export type RecordDetail = {
  head: PetHeader;
  kind: RecordKind;
  id: string;
  /** Título do cabeçalho: «Antirrábica», «Meloxicam», «Peso». */
  title: string;
  /** Rótulo do tipo: «Vacina», «Medicação», «Peso». */
  typeLabel: string;
  date: string;
  fields: { label: string; value: string }[];
  nextDue: string | null;
  visit: { id: string; label: string } | null;
  notes: string | null;
  createdByName: string;
  createdAt: string;
  canEdit: boolean;
  /** Medicação ainda a decorrer: mostra «Terminar medicação». */
  endable: boolean;
};

/** Ecrã 19: um registo (evento de saúde, medicação ou peso) do animal. */
export async function getRecordDetail(
  petId: string,
  kind: RecordKind,
  id: string,
  today: string,
): Promise<RecordDetail> {
  const head = await getPetHeader(petId);
  const supabase = await createClient();

  type Base = {
    title: string;
    typeLabel: string;
    date: string;
    fields: { label: string; value: string }[];
    nextDue: string | null;
    visitId: string | null;
    notes: string | null;
    createdBy: string | null;
    createdAt: string;
    endable: boolean;
  };
  let base: Base;

  if (kind === "evento") {
    const { data } = await supabase
      .from("health_events")
      .select(
        "id, type, title, product, occurred_on, next_due_on, notes, vet_visit_id, created_by, created_at",
      )
      .eq("id", id)
      .eq("pet_id", petId)
      .maybeSingle();
    if (!data) notFound();
    base = {
      title: data.title,
      typeLabel: eventTypeLabel(data.type),
      date: data.occurred_on,
      fields: data.product ? [{ label: "Produto", value: data.product }] : [],
      nextDue: data.next_due_on,
      visitId: data.vet_visit_id,
      notes: data.notes,
      createdBy: data.created_by,
      createdAt: data.created_at,
      endable: false,
    };
  } else if (kind === "medicacao") {
    const { data } = await supabase
      .from("medications")
      .select(
        "id, name, dose, schedule_rrule, starts_on, ends_on, notes, vet_visit_id, created_by, created_at",
      )
      .eq("id", id)
      .eq("pet_id", petId)
      .maybeSingle();
    if (!data) notFound();
    const fields: Base["fields"] = [];
    if (data.dose) fields.push({ label: "Dose", value: data.dose });
    const freq = describeRRule(data.schedule_rrule);
    if (freq) fields.push({ label: "Frequência", value: freq });
    fields.push({
      label: "Até quando",
      value: data.ends_on ? formatISODate(data.ends_on) : "Sem data de fim",
    });
    base = {
      title: data.name,
      typeLabel: "Medicação",
      date: data.starts_on,
      fields,
      nextDue: null,
      visitId: data.vet_visit_id,
      notes: data.notes,
      createdBy: data.created_by,
      createdAt: data.created_at,
      endable: !data.ends_on || data.ends_on > today,
    };
  } else {
    const { data } = await supabase
      .from("weights")
      .select(
        "id, weight_kg, measured_on, vet_visit_id, created_by, created_at",
      )
      .eq("id", id)
      .eq("pet_id", petId)
      .maybeSingle();
    if (!data) notFound();
    base = {
      title: formatKg(Number(data.weight_kg)),
      typeLabel: "Peso",
      date: data.measured_on,
      fields: [],
      nextDue: null,
      visitId: data.vet_visit_id,
      notes: null,
      createdBy: data.created_by,
      createdAt: data.created_at,
      endable: false,
    };
  }

  let visit: RecordDetail["visit"] = null;
  if (base.visitId) {
    const { data: v } = await supabase
      .from("vet_visits")
      .select("id, visited_on, reason")
      .eq("id", base.visitId)
      .maybeSingle();
    if (v) {
      visit = {
        id: v.id,
        label: `${v.reason ?? "Consulta"} · ${formatISODate(v.visited_on)}`,
      };
    }
  }
  const names = await namesFor(supabase, [base.createdBy], head.meId);

  return {
    head,
    kind,
    id,
    title: base.title,
    typeLabel: base.typeLabel,
    date: base.date,
    fields: base.fields,
    nextDue: base.nextDue,
    visit,
    notes: base.notes,
    createdByName: base.createdBy
      ? (names.get(base.createdBy) ?? "outra pessoa")
      : "outra pessoa",
    createdAt: base.createdAt,
    canEdit: canEditRecord(head, base.createdBy),
    endable: base.endable,
  };
}
