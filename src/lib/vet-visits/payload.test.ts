import { describe, expect, it } from "vitest";

import type { TreatmentItem, VisitDraft } from "./draft";
import { buildPayload, effectiveNextDue } from "./payload";

const PET = "a0000000-0000-4000-8000-000000000001";

const draft = (over: Partial<VisitDraft> = {}): VisitDraft => ({
  petId: PET,
  visitDate: "2026-11-21",
  reason: "Vacinação",
  vet: "Dra. Inês",
  items: [],
  weight: null,
  cost: "",
  paidBy: null,
  notes: "",
  documentId: null,
  ...over,
});

const vaccine: TreatmentItem = {
  kind: "treatment",
  key: "k1",
  type: "vaccine",
  title: "Antirrábica",
  presetId: null,
  product: "Nobivac",
  intervalMonths: 12,
  nextDue: "",
  nextDueManual: false,
  remind: true,
};

describe("próxima data do tratamento", () => {
  it("acompanha a data da consulta até ser editada", () => {
    expect(effectiveNextDue(vaccine, "2026-11-21")).toBe("2027-11-21");
    expect(effectiveNextDue(vaccine, "2026-11-01")).toBe("2027-11-01");
    expect(
      effectiveNextDue(
        { ...vaccine, nextDue: "2027-01-05", nextDueManual: true },
        "2026-11-21",
      ),
    ).toBe("2027-01-05");
  });
});

describe("buildPayload", () => {
  it("consulta completa: peso, custo em cêntimos, vacina e medicação com RRULE", () => {
    const { payload, errors } = buildPayload(
      draft({
        weight: "12,4",
        cost: "45,00",
        items: [
          vaccine,
          {
            kind: "medication",
            key: "k2",
            name: "Meloxicam",
            dose: "½ comp.",
            otherFrequency: "",
            remind: true,
            draft: {
              frequency: "daily1",
              everyDays: 2,
              time: "08:00",
              time2: "20:00",
              duration: "days",
              days: 7,
              until: "",
              startsOn: "2026-11-21",
            },
          },
        ],
      }),
    );
    expect(errors).toEqual({});
    expect(payload.weight_kg).toBe(12.4);
    expect(payload.expense).toMatchObject({
      amount_cents: 4500,
      category: "veterinary",
    });
    expect(payload.health_events?.[0]).toMatchObject({
      type: "vaccine",
      title: "Antirrábica",
      next_due_on: "2027-11-21",
      remind: true,
    });
    expect(payload.medications?.[0]).toMatchObject({
      name: "Meloxicam",
      starts_on: "2026-11-21",
      ends_on: "2026-11-27",
    });
    expect(payload.medications?.[0]?.schedule_rrule).toContain("FREQ=DAILY");
  });

  it("custo 0 ou vazio não cria despesa", () => {
    expect(buildPayload(draft({ cost: "0" })).payload.expense).toBeUndefined();
    expect(buildPayload(draft({ cost: "" })).payload.expense).toBeUndefined();
  });

  it("assinala motivo, peso e custo inválidos", () => {
    const { errors } = buildPayload(
      draft({ reason: " ", weight: "abc", cost: "1,234" }),
    );
    expect(errors.reason).toBe("Escreve o motivo.");
    expect(errors.weight_kg).toMatch(/peso/);
    expect(errors["expense.amount_cents"]).toMatch(/valor/);
  });

  it("assinala um registo «Outro» sem título", () => {
    const { errors } = buildPayload(
      draft({
        items: [
          { kind: "other", key: "k3", type: "other", title: "", notes: "" },
        ],
      }),
    );
    expect(errors["health_events.0.title"]).toBe("Escreve o nome.");
  });
});
