import { describe, expect, it } from "vitest";

import {
  buildTimeline,
  groupByMonth,
  matchesFilter,
  monthLabel,
  parseFilter,
  type RawTimeline,
} from "./timeline";

const empty: RawTimeline = {
  petId: "p1",
  visits: [],
  events: [],
  medications: [],
  weights: [],
  expenses: [],
  documents: [],
  names: new Map([["u1", "Mãe"]]),
};

describe("agrupar por mês", () => {
  it("nome do mês em português", () => {
    expect(monthLabel("2026-11")).toBe("novembro de 2026");
    expect(monthLabel("2026-03")).toBe("março de 2026");
  });

  it("agrupa mantendo a ordem (mais recente primeiro)", () => {
    const groups = groupByMonth([
      { date: "2026-11-20" },
      { date: "2026-11-02" },
      { date: "2026-10-30" },
      { date: "2025-11-30" },
    ]);
    expect(groups.map((g) => [g.label, g.entries.length])).toEqual([
      ["novembro de 2026", 2],
      ["outubro de 2026", 1],
      ["novembro de 2025", 1],
    ]);
  });
});

describe("cronologia", () => {
  const raw: RawTimeline = {
    ...empty,
    visits: [
      {
        id: "v1",
        visited_on: "2026-11-10",
        reason: "Vacinação",
        vet_name: "Dra. Inês",
        created_by: "u1",
        created_at: "2026-11-10T10:00:00Z",
      },
    ],
    events: [
      {
        id: "e1",
        type: "vaccine",
        title: "Antirrábica",
        product: null,
        occurred_on: "2026-11-10",
        vet_visit_id: "v1",
        created_by: "u1",
        created_at: "2026-11-10T10:00:01Z",
      },
      {
        id: "e2",
        type: "deworming_external",
        title: "Desparasitação externa",
        product: "Bravecto",
        occurred_on: "2026-11-15",
        vet_visit_id: null,
        created_by: "u1",
        created_at: "2026-11-15T09:00:00Z",
      },
    ],
    weights: [
      {
        id: "w1",
        measured_on: "2026-11-10",
        weight_kg: 12.4,
        vet_visit_id: "v1",
        created_by: "u1",
        created_at: "2026-11-10T10:00:02Z",
      },
      {
        id: "w2",
        measured_on: "2026-10-01",
        weight_kg: 12,
        vet_visit_id: null,
        created_by: null,
        created_at: "2026-10-01T08:00:00Z",
      },
    ],
    expenses: [
      {
        id: "x1",
        spent_on: "2026-11-10",
        category: "veterinary",
        amount_cents: 4500,
        description: null,
        vet_visit_id: "v1",
        created_by: "u1",
        created_at: "2026-11-10T10:00:03Z",
      },
    ],
    documents: [
      {
        id: "d1",
        kind: "invoice",
        title: "Fatura",
        document_date: null,
        vet_visit_id: "v1",
        created_by: "u1",
        created_at: "2026-11-10T10:00:04Z",
      },
    ],
  };
  const entries = buildTimeline(raw);

  it("o que foi registado na consulta fica dentro dela, sem duplicar", () => {
    expect(entries.map((e) => e.key)).toEqual([
      "event-e2",
      "visit-v1",
      "weight-w2",
    ]);
    const visit = entries.find((e) => e.kind === "visit")!;
    expect(visit.summary).toBe(
      "Dra. Inês · Antirrábica · 12,4 kg · 45,00 € · anexo",
    );
    expect(visit.createdBy).toBe("Mãe");
    expect(visit.href).toBe("/animais/p1/consulta/v1");
  });

  it("a consulta conta para os filtros de tudo o que contém", () => {
    const keys = (f: Parameters<typeof matchesFilter>[1]) =>
      entries.filter((e) => matchesFilter(e, f)).map((e) => e.key);
    expect(keys("tudo")).toHaveLength(3);
    expect(keys("consultas")).toEqual(["visit-v1"]);
    expect(keys("vacinas")).toEqual(["visit-v1"]);
    expect(keys("desparasitacoes")).toEqual(["event-e2"]);
    expect(keys("peso")).toEqual(["visit-v1", "weight-w2"]);
    expect(keys("despesas")).toEqual(["visit-v1"]);
    expect(keys("documentos")).toEqual(["visit-v1"]);
    expect(keys("medicacao")).toEqual([]);
  });

  it("filtro desconhecido volta a «tudo»", () => {
    expect(parseFilter("peso")).toBe("peso");
    expect(parseFilter("xpto")).toBe("tudo");
    expect(parseFilter(undefined)).toBe("tudo");
  });
});
