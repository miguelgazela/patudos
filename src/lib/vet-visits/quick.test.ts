import { describe, expect, it } from "vitest";

import type { TreatmentItem } from "./draft";
import { buildTreatmentPayload, buildWeightPayload } from "./quick";

const PET = "0b3c0a7e-3f5e-4c52-8d0a-0f1f4f0c9a11";

const item = (over: Partial<TreatmentItem> = {}): TreatmentItem => ({
  kind: "treatment",
  key: "k",
  type: "vaccine",
  title: "Raiva",
  presetId: null,
  product: "",
  intervalMonths: 12,
  nextDue: "",
  nextDueManual: false,
  remind: true,
  ...over,
});

describe("buildWeightPayload", () => {
  it("aceita vírgula e devolve kg numérico", () => {
    const r = buildWeightPayload({
      petId: PET,
      date: "2026-11-22",
      kg: "12,4",
    });
    expect(r.errors).toEqual({});
    expect(r.payload).toEqual({
      pet_id: PET,
      measured_on: "2026-11-22",
      weight_kg: 12.4,
    });
  });
  it("recusa vazio e zero", () => {
    expect(
      buildWeightPayload({ petId: PET, date: "", kg: "" }).errors.weight_kg,
    ).toBeTruthy();
    expect(
      buildWeightPayload({ petId: PET, date: "", kg: "0" }).payload,
    ).toBeNull();
  });
});

describe("buildTreatmentPayload", () => {
  it("sugere a próxima data a partir da data do registo (também passada)", () => {
    const r = buildTreatmentPayload({
      petId: PET,
      date: "2025-01-31",
      item: item(),
      cost: "",
    });
    expect(r.payload?.occurred_on).toBe("2025-01-31");
    expect(r.payload?.next_due_on).toBe("2026-01-31");
    expect(r.payload?.expense).toBeUndefined();
  });
  it("custo vira cêntimos; zero não cria despesa; inválido dá erro", () => {
    const base = { petId: PET, date: "2026-11-22", item: item() };
    expect(
      buildTreatmentPayload({ ...base, cost: "12,5" }).payload?.expense,
    ).toEqual({ amount_cents: 1250 });
    expect(
      buildTreatmentPayload({ ...base, cost: "0" }).payload?.expense,
    ).toBeUndefined();
    expect(
      buildTreatmentPayload({ ...base, cost: "abc" }).errors[
        "expense.amount_cents"
      ],
    ).toBeTruthy();
  });
  it("«Outra» sem tipo vira desparasitação interna e título vazio falha", () => {
    expect(
      buildTreatmentPayload({
        petId: PET,
        date: "2026-11-22",
        item: item({ type: "other", intervalMonths: null }),
        cost: "",
      }).payload?.type,
    ).toBe("deworming_internal");
    expect(
      buildTreatmentPayload({
        petId: PET,
        date: "2026-11-22",
        item: item({ title: "" }),
        cost: "",
      }).errors.title,
    ).toBeTruthy();
  });
});
