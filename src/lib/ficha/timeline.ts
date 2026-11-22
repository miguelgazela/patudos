import { formatCents, formatKg } from "@/lib/units";

import {
  DOCUMENT_KIND_LABEL,
  EXPENSE_CATEGORY_LABEL,
  eventTypeLabel,
} from "./labels";
import { describeRRule } from "@/lib/vet-visits/schedule";

export const FILTERS = [
  { key: "tudo", label: "Tudo" },
  { key: "consultas", label: "Consultas" },
  { key: "vacinas", label: "Vacinas" },
  { key: "desparasitacoes", label: "Desparasitações" },
  { key: "medicacao", label: "Medicação" },
  { key: "peso", label: "Peso" },
  { key: "despesas", label: "Despesas" },
  { key: "documentos", label: "Documentos" },
] as const;

export type FilterKey = (typeof FILTERS)[number]["key"];

export function parseFilter(value: string | string[] | undefined): FilterKey {
  return FILTERS.find((f) => f.key === value)?.key ?? "tudo";
}

export type EntryKind =
  | "visit"
  | "vaccine"
  | "deworming"
  | "event"
  | "medication"
  | "weight"
  | "expense"
  | "document";

export type TimelineEntry = {
  key: string;
  kind: EntryKind;
  /** yyyy-mm-dd */
  date: string;
  createdAt: string;
  title: string;
  summary: string;
  /** `null` = sem ecrã de detalhe (despesas). */
  href: string | null;
  /** Abre noutro separador (documentos, por URL assinada). */
  external?: boolean;
  createdBy: string | null;
  /** Filtros em que aparece (além de «Tudo»). */
  tags: Exclude<FilterKey, "tudo">[];
};

export type RawVisit = {
  id: string;
  visited_on: string;
  reason: string | null;
  vet_name: string | null;
  created_by: string | null;
  created_at: string;
};
export type RawEvent = {
  id: string;
  type: string;
  title: string;
  product: string | null;
  occurred_on: string;
  vet_visit_id: string | null;
  created_by: string | null;
  created_at: string;
};
export type RawMedication = {
  id: string;
  name: string;
  dose: string | null;
  schedule_rrule: string | null;
  starts_on: string;
  vet_visit_id: string | null;
  created_by: string | null;
  created_at: string;
};
export type RawWeight = {
  id: string;
  measured_on: string;
  weight_kg: number;
  vet_visit_id: string | null;
  created_by: string | null;
  created_at: string;
};
export type RawExpense = {
  id: string;
  spent_on: string;
  category: string;
  amount_cents: number;
  description: string | null;
  vet_visit_id: string | null;
  created_by: string | null;
  created_at: string;
};
export type RawDocument = {
  id: string;
  kind: string;
  title: string;
  document_date: string | null;
  vet_visit_id: string | null;
  created_by: string | null;
  created_at: string;
};

export type RawTimeline = {
  petId: string;
  visits: RawVisit[];
  events: RawEvent[];
  medications: RawMedication[];
  weights: RawWeight[];
  expenses: RawExpense[];
  documents: RawDocument[];
  /** id do utilizador → nome. */
  names: Map<string, string>;
  /** id do documento → URL assinada. */
  documentUrls: Map<string, string>;
};

function eventTag(type: string): "vacinas" | "desparasitacoes" | null {
  if (type === "vaccine") return "vacinas";
  return type.startsWith("deworming") ? "desparasitacoes" : null;
}

function eventKind(type: string): EntryKind {
  if (type === "vaccine") return "vaccine";
  return type.startsWith("deworming") ? "deworming" : "event";
}

/**
 * Cronologia de um animal, do mais recente para o mais antigo.
 * Decisão: o que foi registado numa consulta aparece DENTRO dela (resumo numa linha e ligação ao
 * detalhe), não como entradas separadas, para não duplicar. A consulta conta para os filtros
 * de tudo o que contém.
 */
export function buildTimeline(raw: RawTimeline): TimelineEntry[] {
  const base = `/animais/${raw.petId}`;
  const entries: TimelineEntry[] = [];
  const children = new Map<string, string[]>();
  const childTags = new Map<string, Set<TimelineEntry["tags"][number]>>();

  const addChild = (
    visitId: string | null,
    text: string,
    tag: TimelineEntry["tags"][number] | null,
  ) => {
    if (!visitId) return;
    if (text === "anexo" && children.get(visitId)?.includes(text)) return;
    children.set(visitId, [...(children.get(visitId) ?? []), text]);
    if (tag) {
      const set = childTags.get(visitId) ?? new Set();
      set.add(tag);
      childTags.set(visitId, set);
    }
  };
  const who = (id: string | null) => (id ? (raw.names.get(id) ?? null) : null);

  for (const e of raw.events) {
    if (e.vet_visit_id) {
      addChild(e.vet_visit_id, e.title, eventTag(e.type));
      continue;
    }
    const tag = eventTag(e.type);
    entries.push({
      key: `event-${e.id}`,
      kind: eventKind(e.type),
      date: e.occurred_on,
      createdAt: e.created_at,
      title: e.title,
      summary: [eventTypeLabel(e.type), e.product].filter(Boolean).join(" · "),
      href: `${base}/registo/evento/${e.id}`,
      createdBy: who(e.created_by),
      tags: tag ? [tag] : [],
    });
  }

  for (const m of raw.medications) {
    if (m.vet_visit_id) {
      addChild(m.vet_visit_id, m.name, "medicacao");
      continue;
    }
    entries.push({
      key: `med-${m.id}`,
      kind: "medication",
      date: m.starts_on,
      createdAt: m.created_at,
      title: m.name,
      summary: [m.dose, describeRRule(m.schedule_rrule)]
        .filter(Boolean)
        .join(" · "),
      href: `${base}/registo/medicacao/${m.id}`,
      createdBy: who(m.created_by),
      tags: ["medicacao"],
    });
  }

  for (const w of raw.weights) {
    if (w.vet_visit_id) {
      addChild(w.vet_visit_id, formatKg(Number(w.weight_kg)), "peso");
      continue;
    }
    entries.push({
      key: `weight-${w.id}`,
      kind: "weight",
      date: w.measured_on,
      createdAt: w.created_at,
      title: `Peso ${formatKg(Number(w.weight_kg))}`,
      summary: "Em casa",
      href: `${base}/registo/peso/${w.id}`,
      createdBy: who(w.created_by),
      tags: ["peso"],
    });
  }

  for (const x of raw.expenses) {
    if (x.vet_visit_id) {
      addChild(x.vet_visit_id, formatCents(x.amount_cents), "despesas");
      continue;
    }
    entries.push({
      key: `expense-${x.id}`,
      kind: "expense",
      date: x.spent_on,
      createdAt: x.created_at,
      title:
        x.description?.trim() ||
        (EXPENSE_CATEGORY_LABEL[x.category] ?? "Despesa"),
      summary: formatCents(x.amount_cents),
      href: null,
      createdBy: who(x.created_by),
      tags: ["despesas"],
    });
  }

  for (const d of raw.documents) {
    if (d.vet_visit_id) {
      addChild(d.vet_visit_id, "anexo", "documentos");
      continue;
    }
    const url = raw.documentUrls.get(d.id) ?? null;
    entries.push({
      key: `doc-${d.id}`,
      kind: "document",
      date: d.document_date ?? d.created_at.slice(0, 10),
      createdAt: d.created_at,
      title: d.title,
      summary: DOCUMENT_KIND_LABEL[d.kind] ?? "Documento",
      href: url,
      external: !!url,
      createdBy: who(d.created_by),
      tags: ["documentos"],
    });
  }

  for (const v of raw.visits) {
    entries.push({
      key: `visit-${v.id}`,
      kind: "visit",
      date: v.visited_on,
      createdAt: v.created_at,
      title: v.reason?.trim() || "Consulta",
      summary: [v.vet_name, ...(children.get(v.id) ?? [])]
        .filter(Boolean)
        .join(" · "),
      href: `${base}/consulta/${v.id}`,
      createdBy: who(v.created_by),
      tags: ["consultas", ...(childTags.get(v.id) ?? [])],
    });
  }

  return entries.sort(
    (a, b) =>
      b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
  );
}

export function matchesFilter(entry: TimelineEntry, filter: FilterKey) {
  return filter === "tudo" || entry.tags.includes(filter);
}

/** «novembro de 2026» (a partir de «2026-11»). */
export function monthLabel(yearMonth: string): string {
  const [y = 0, m = 1] = yearMonth.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-PT", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, 1)));
}

export type MonthGroup<T> = { key: string; label: string; entries: T[] };

/** Agrupa por mês, mantendo a ordem (os mais recentes primeiro). */
export function groupByMonth<T extends { date: string }>(
  entries: T[],
): MonthGroup<T>[] {
  const groups: MonthGroup<T>[] = [];
  for (const entry of entries) {
    const key = entry.date.slice(0, 7);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.entries.push(entry);
    else groups.push({ key, label: monthLabel(key), entries: [entry] });
  }
  return groups;
}
