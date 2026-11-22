import { describe, expect, it } from "vitest";

import { addMonthsISO, suggestNextDue } from "./next-due";
import {
  homeTreatmentSchema,
  quickWeightSchema,
  vetVisitSchema,
} from "./schema";

const PET = "a0000000-0000-4000-8000-000000000001";

describe("próxima data sugerida", () => {
  it("soma meses", () => {
    expect(suggestNextDue("2026-11-20", 12)).toBe("2027-11-20");
    expect(suggestNextDue("2026-11-20", 3)).toBe("2027-02-20");
    expect(suggestNextDue("2026-12-15", 1)).toBe("2027-01-15");
  });
  it("não passa do fim do mês", () => {
    expect(addMonthsISO("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsISO("2024-02-29", 12)).toBe("2025-02-28");
  });
});

describe("vetVisitSchema", () => {
  it("aceita uma consulta completa", () => {
    const r = vetVisitSchema.safeParse({
      pet_id: PET,
      visited_on: "2026-11-20",
      reason: " Vacinação ",
      vet_name: "",
      weight_kg: 12.4,
      health_events: [
        { type: "vaccine", title: "Antirrábica", next_due_on: "2027-11-20" },
      ],
      medications: [{ name: "Apoquel", dose: "½ comprimido" }],
      expense: { amount_cents: 4500, category: "veterinary" },
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.reason).toBe("Vacinação");
      expect(r.data.vet_name).toBeUndefined();
      expect(r.data.health_events[0]?.remind).toBe(true);
    }
  });

  it("só exige animal e motivo", () => {
    expect(
      vetVisitSchema.safeParse({ pet_id: PET, reason: "Check-up" }).success,
    ).toBe(true);
    const r = vetVisitSchema.safeParse({ pet_id: PET, reason: "  " });
    expect(r.success).toBe(false);
    if (!r.success)
      expect(r.error.issues[0]?.message).toBe("Escreve o motivo.");
  });

  it("rejeita peso inválido", () => {
    for (const weight_kg of [0, -1, 1000, 12.345]) {
      expect(
        vetVisitSchema.safeParse({ pet_id: PET, reason: "x", weight_kg })
          .success,
      ).toBe(false);
    }
  });

  it("dinheiro em cêntimos inteiros e não negativos", () => {
    const base = { pet_id: PET, reason: "x" };
    expect(
      vetVisitSchema.safeParse({
        ...base,
        expense: { amount_cents: 12.5, category: "food" },
      }).success,
    ).toBe(false);
    expect(
      vetVisitSchema.safeParse({
        ...base,
        expense: { amount_cents: -1, category: "food" },
      }).success,
    ).toBe(false);
    expect(
      vetVisitSchema.safeParse({
        ...base,
        expense: { amount_cents: 0, category: "food" },
      }).success,
    ).toBe(true);
    expect(
      vetVisitSchema.safeParse({
        ...base,
        expense: { amount_cents: 100, category: "viagens" },
      }).success,
    ).toBe(false);
  });

  it("valida datas e ordem das datas", () => {
    const base = { pet_id: PET, reason: "x" };
    expect(
      vetVisitSchema.safeParse({ ...base, visited_on: "2026-02-30" }).success,
    ).toBe(false);
    expect(
      vetVisitSchema.safeParse({ ...base, visited_on: "20/11/2026" }).success,
    ).toBe(false);
    const ev = vetVisitSchema.safeParse({
      ...base,
      health_events: [
        {
          type: "vaccine",
          title: "x",
          occurred_on: "2026-05-01",
          next_due_on: "2026-04-01",
        },
      ],
    });
    expect(ev.success).toBe(false);
    const med = vetVisitSchema.safeParse({
      ...base,
      medications: [
        { name: "x", starts_on: "2026-05-02", ends_on: "2026-05-01" },
      ],
    });
    expect(med.success).toBe(false);
  });

  it("rejeita ids inválidos e tipos desconhecidos", () => {
    expect(
      vetVisitSchema.safeParse({ pet_id: "nina", reason: "x" }).success,
    ).toBe(false);
    expect(
      vetVisitSchema.safeParse({
        pet_id: PET,
        reason: "x",
        health_events: [{ type: "dança", title: "x" }],
      }).success,
    ).toBe(false);
  });
});

describe("registos rápidos", () => {
  it("peso", () => {
    expect(
      quickWeightSchema.safeParse({ pet_id: PET, weight_kg: 12.6 }).success,
    ).toBe(true);
    expect(quickWeightSchema.safeParse({ pet_id: PET }).success).toBe(false);
  });
  it("tratamento em casa", () => {
    const ok = homeTreatmentSchema.safeParse({
      pet_id: PET,
      type: "deworming_external",
      title: "Desparasitação externa",
      expense: { amount_cents: 1250 },
    });
    expect(ok.success).toBe(true);
    expect(
      homeTreatmentSchema.safeParse({
        pet_id: PET,
        type: "surgery",
        title: "x",
      }).success,
    ).toBe(false);
  });
});
