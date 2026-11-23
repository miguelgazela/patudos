import { formatISODate } from "@/lib/dates";
import { formatAge } from "@/lib/pets/age";
import { speciesLabel } from "@/lib/pets/labels";
import { formatKg } from "@/lib/units";
import { describeRRule } from "@/lib/vet-visits/schedule";

import { eventTypeLabel } from "@/lib/ficha/labels";

/** O que incluir na ficha. */
export const PDF_INCLUDES = ["all", "vaccines"] as const;
export type PdfInclude = (typeof PDF_INCLUDES)[number];

/** Período do historial. */
export const PDF_PERIODS = ["year", "all"] as const;
export type PdfPeriod = (typeof PDF_PERIODS)[number];

export type PdfOptions = { include: PdfInclude; period: PdfPeriod };

export const DEFAULT_PDF_OPTIONS: PdfOptions = {
  include: "all",
  period: "year",
};

/** Lê as opções do URL; valores desconhecidos caem nos por defeito. */
export function parsePdfOptions(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
): PdfOptions {
  const get = (k: string) => {
    const v = params instanceof URLSearchParams ? params.get(k) : params[k];
    return Array.isArray(v) ? v[0] : (v ?? undefined);
  };
  const include = get("incluir");
  const period = get("periodo");
  return {
    include: (PDF_INCLUDES as readonly string[]).includes(include ?? "")
      ? (include as PdfInclude)
      : DEFAULT_PDF_OPTIONS.include,
    period: (PDF_PERIODS as readonly string[]).includes(period ?? "")
      ? (period as PdfPeriod)
      : DEFAULT_PDF_OPTIONS.period,
  };
}

export type RawPdfData = {
  pet: {
    name: string;
    species: string;
    sex: string | null;
    breed: string | null;
    birth_date: string | null;
    neutered: boolean | null;
    microchip: string | null;
  };
  people: { name: string; role: "owner" | "caregiver" }[];
  events: {
    type: string;
    title: string;
    product: string | null;
    occurred_on: string;
    next_due_on: string | null;
  }[];
  medications: {
    name: string;
    dose: string | null;
    schedule_rrule: string | null;
    starts_on: string;
    ends_on: string | null;
  }[];
  weights: { measured_on: string; weight_kg: number }[];
  visits: {
    visited_on: string;
    reason: string | null;
    vet_name: string | null;
    clinic: string | null;
  }[];
};

export type PdfModel = {
  options: PdfOptions;
  generatedOn: string;
  header: {
    name: string;
    /** «Cadela · Podengo». */
    subtitle: string;
    facts: { label: string; value: string }[];
  };
  contacts: {
    vet: { name: string | null; clinic: string | null } | null;
    people: { name: string; role: string }[];
  };
  vaccines: PdfEventRow[];
  dewormings: PdfEventRow[];
  otherEvents: PdfEventRow[];
  /** Só em «Tudo». */
  medications: PdfMedicationRow[] | null;
  weights: {
    rows: PdfWeightRow[];
    series: { on: string; kg: number }[];
  } | null;
  visits: PdfVisitRow[] | null;
  periodLabel: string;
};

export type PdfEventRow = {
  title: string;
  /** Produto (marca), se houver. */
  product: string | null;
  date: string;
  nextDue: string | null;
};
export type PdfMedicationRow = {
  name: string;
  dose: string;
  frequency: string;
  until: string;
};
export type PdfWeightRow = { date: string; value: string };
export type PdfVisitRow = {
  date: string;
  reason: string;
  vet: string;
};

const MAX_WEIGHT_ROWS = 10;
const MAX_VISITS = 8;

/** Data de há um ano (mesmo dia), «yyyy-mm-dd». */
export function oneYearBefore(today: string): string {
  const [y = 0, m = 1, d = 1] = today.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y - 1, m, 0)).getUTCDate();
  return `${y - 1}-${String(m).padStart(2, "0")}-${String(Math.min(d, lastDay)).padStart(2, "0")}`;
}

function byDateDesc<T>(items: T[], key: (t: T) => string): T[] {
  return [...items].sort((a, b) => key(b).localeCompare(key(a)));
}

const EVENT_GROUPS = {
  vaccines: ["vaccine"],
  dewormings: ["deworming_internal", "deworming_external"],
} as const;

function eventRow(e: RawPdfData["events"][number]): PdfEventRow {
  const kind =
    e.type === "deworming_internal"
      ? "Interna"
      : e.type === "deworming_external"
        ? "Externa"
        : null;
  const title = kind ? `${kind} · ${e.title}` : e.title;
  return {
    title:
      e.type === "other" || e.type === "surgery" || e.type === "lab_test"
        ? `${eventTypeLabel(e.type)} · ${e.title}`
        : title,
    product: e.product?.trim() || null,
    date: formatISODate(e.occurred_on),
    nextDue: e.next_due_on ? formatISODate(e.next_due_on) : null,
  };
}

/**
 * Num período limitado, mantém as doses dentro do período e, por tratamento
 * (tipo + título), a mais recente, para o estado de vacinação ficar sempre completo.
 */
function inPeriod(
  events: RawPdfData["events"],
  cutoff: string | null,
): RawPdfData["events"] {
  if (!cutoff) return events;
  const latest = new Map<string, RawPdfData["events"][number]>();
  for (const e of events) {
    const key = `${e.type}|${e.title.trim().toLowerCase()}`;
    const cur = latest.get(key);
    if (!cur || e.occurred_on > cur.occurred_on) latest.set(key, e);
  }
  const keep = new Set(latest.values());
  return events.filter((e) => e.occurred_on >= cutoff || keep.has(e));
}

/** Modelo do PDF: o que entra com cada opção, ordenações e formatos (sem dados financeiros). */
export function buildPdfModel(
  raw: RawPdfData,
  options: PdfOptions,
  today: string,
): PdfModel {
  const cutoff = options.period === "year" ? oneYearBefore(today) : null;
  const all = options.include === "all";
  const { pet } = raw;
  const female = pet.sex === "female";

  const facts: PdfModel["header"]["facts"] = [];
  if (pet.birth_date) {
    facts.push({
      label: "Nascimento",
      value: `${formatISODate(pet.birth_date)} (${formatAge(pet.birth_date, new Date(`${today}T12:00:00Z`))})`,
    });
  }
  if (pet.sex === "female" || pet.sex === "male") {
    facts.push({ label: "Sexo", value: female ? "Fêmea" : "Macho" });
  }
  if (pet.neutered !== null) {
    facts.push({
      label: "Esterilização",
      value: pet.neutered ? (female ? "Esterilizada" : "Esterilizado") : "Não",
    });
  }
  if (pet.microchip) facts.push({ label: "Chip", value: pet.microchip });

  // Veterinário e clínica: da consulta mais recente que os tenha.
  const withVet = byDateDesc(raw.visits, (v) => v.visited_on).find(
    (v) => v.vet_name?.trim() || v.clinic?.trim(),
  );

  const events = inPeriod(
    byDateDesc(raw.events, (e) => e.occurred_on),
    cutoff,
  );
  const rowsOf = (types: readonly string[]) =>
    events.filter((e) => types.includes(e.type)).map(eventRow);

  const otherTypes = ["surgery", "lab_test", "other"];

  const medications = all
    ? byDateDesc(
        raw.medications.filter((m) => !m.ends_on || m.ends_on >= today),
        (m) => m.starts_on,
      ).map<PdfMedicationRow>((m) => ({
        name: m.name,
        dose: m.dose?.trim() || "",
        frequency: describeRRule(m.schedule_rrule),
        until: m.ends_on ? formatISODate(m.ends_on) : "Contínua",
      }))
    : null;

  let weights: PdfModel["weights"] = null;
  if (all) {
    const ordered = byDateDesc(
      raw.weights.filter((w) => !cutoff || w.measured_on >= cutoff),
      (w) => w.measured_on,
    );
    weights = {
      rows: ordered.slice(0, MAX_WEIGHT_ROWS).map((w) => ({
        date: formatISODate(w.measured_on),
        value: formatKg(w.weight_kg),
      })),
      series: [...ordered].reverse().map((w) => ({
        on: w.measured_on,
        kg: w.weight_kg,
      })),
    };
  }

  const visits = all
    ? byDateDesc(
        raw.visits.filter((v) => !cutoff || v.visited_on >= cutoff),
        (v) => v.visited_on,
      )
        .slice(0, MAX_VISITS)
        .map<PdfVisitRow>((v) => ({
          date: formatISODate(v.visited_on),
          reason: v.reason?.trim() || "Consulta",
          vet: [v.vet_name?.trim(), v.clinic?.trim()]
            .filter(Boolean)
            .join(" · "),
        }))
    : null;

  return {
    options,
    generatedOn: formatISODate(today),
    header: {
      name: pet.name,
      subtitle: [speciesLabel(pet.species, pet.sex), pet.breed?.trim()]
        .filter(Boolean)
        .join(" · "),
      facts,
    },
    contacts: {
      vet: withVet
        ? {
            name: withVet.vet_name?.trim() || null,
            clinic: withVet.clinic?.trim() || null,
          }
        : null,
      people: [...raw.people]
        .sort(
          (a, b) =>
            Number(b.role === "owner") - Number(a.role === "owner") ||
            a.name.localeCompare(b.name, "pt"),
        )
        .map((p) => ({
          name: p.name,
          role: p.role === "owner" ? "Responsável" : "Cuidador",
        })),
    },
    vaccines: rowsOf(EVENT_GROUPS.vaccines),
    dewormings: rowsOf(EVENT_GROUPS.dewormings),
    otherEvents: all ? rowsOf(otherTypes) : [],
    medications,
    weights,
    visits,
    periodLabel: cutoff
      ? `Historial desde ${formatISODate(cutoff)}`
      : "Historial completo",
  };
}

/** Nome do ficheiro: «ficha-nina.pdf» (sem acentos, só a-z0-9 e hífens). */
export function pdfFileName(petName: string): string {
  const slug = petName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `ficha-${slug || "animal"}.pdf`;
}
