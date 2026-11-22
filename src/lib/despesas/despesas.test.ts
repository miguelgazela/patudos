import { describe, expect, it } from "vitest";

import { dayLabel, groupByDay } from "./group";
import { parseOverview } from "./overview";
import { buildExpensePayload, type ExpenseDraft } from "./payload";
import {
  hasNext,
  isCurrent,
  parsePeriod,
  shiftPeriod,
  switchKind,
} from "./period";
import { expenseInputSchema } from "./schema";
import { splitEqually, sumParts } from "./split";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";

describe("splitEqually", () => {
  it("25,01 € por 2 animais: 12,51 + 12,50 (resto para o primeiro)", () => {
    expect(splitEqually(2501, [A, B])).toEqual([
      { petId: A, cents: 1251 },
      { petId: B, cents: 1250 },
    ]);
  });
  it("sem resto, partes iguais", () => {
    expect(splitEqually(1590, [A, B]).map((p) => p.cents)).toEqual([795, 795]);
  });
  it("3 animais: 10,00 € → 3,34 + 3,33 + 3,33 e a soma bate sempre", () => {
    const parts = splitEqually(1000, [A, B, C]);
    expect(parts.map((p) => p.cents)).toEqual([334, 333, 333]);
    expect(sumParts(parts)).toBe(1000);
  });
  it("o resto todo vai para o primeiro: 2,02 € por 4 → 0,52 + 0,50 + 0,50 + 0,50", () => {
    expect(splitEqually(202, [A, B, C, "d"]).map((p) => p.cents)).toEqual([
      52, 50, 50, 50,
    ]);
  });
  it("um animal fica com tudo; nenhum animal, nada", () => {
    expect(splitEqually(4500, [A])).toEqual([{ petId: A, cents: 4500 }]);
    expect(splitEqually(4500, [])).toEqual([]);
  });
});

describe("parsePeriod / shiftPeriod", () => {
  const today = "2026-11-22";
  it("por defeito, o mês atual", () => {
    const p = parsePeriod(undefined, today);
    expect(p).toMatchObject({
      kind: "month",
      key: "2026-11",
      from: "2026-11-01",
      to: "2026-12-01",
      label: "Novembro 2026",
    });
  });
  it("ano", () => {
    expect(parsePeriod("2026", today)).toMatchObject({
      kind: "year",
      from: "2026-01-01",
      to: "2027-01-01",
      label: "Ano 2026",
    });
  });
  it("valores inválidos voltam ao mês atual", () => {
    expect(parsePeriod("2026-13", today).key).toBe("2026-11");
    expect(parsePeriod("abc", today).key).toBe("2026-11");
  });
  it("anterior e seguinte atravessam o ano", () => {
    const jan = parsePeriod("2026-01", today);
    expect(shiftPeriod(jan, -1).key).toBe("2025-12");
    expect(shiftPeriod(parsePeriod("2026-12", today), 1)).toMatchObject({
      key: "2027-01",
      to: "2027-02-01",
    });
    expect(shiftPeriod(parsePeriod("2026", today), -1).key).toBe("2025");
  });
  it("não se avança para o futuro", () => {
    expect(hasNext(parsePeriod("2026-11", today), today)).toBe(false);
    expect(hasNext(parsePeriod("2026-10", today), today)).toBe(true);
    expect(hasNext(parsePeriod("2026", today), today)).toBe(false);
    expect(hasNext(parsePeriod("2025", today), today)).toBe(true);
  });
  it("isCurrent e mudar entre mês e ano", () => {
    const nov = parsePeriod("2026-11", today);
    expect(isCurrent(nov, today)).toBe(true);
    expect(isCurrent(parsePeriod("2026-10", today), today)).toBe(false);
    expect(switchKind(nov, "year", today).key).toBe("2026");
    expect(switchKind(parsePeriod("2026", today), "month", today).key).toBe(
      "2026-11",
    );
    expect(switchKind(parsePeriod("2025", today), "month", today).key).toBe(
      "2025-12",
    );
  });
});

describe("groupByDay", () => {
  it("rótulo do dia em PT-PT", () => {
    expect(dayLabel("2026-11-21")).toBe("Sábado, 21/11");
    expect(dayLabel("2026-11-18")).toBe("Quarta-feira, 18/11");
  });
  it("agrupa dias seguidos mantendo a ordem", () => {
    const groups = groupByDay([
      { id: 1, spentOn: "2026-11-21" },
      { id: 2, spentOn: "2026-11-21" },
      { id: 3, spentOn: "2026-11-18" },
    ]);
    expect(groups.map((g) => [g.date, g.items.map((i) => i.id)])).toEqual([
      ["2026-11-21", [1, 2]],
      ["2026-11-18", [3]],
    ]);
  });
});

describe("parseOverview", () => {
  it("converte a resposta da RPC", () => {
    const o = parseOverview({
      total_cents: 4700,
      by_pet: [{ pet_id: A, amount_cents: 4700 }],
      by_category: [{ category: "food", amount_cents: 4700 }],
      by_payer: [{ paid_by: null, amount_cents: 4700 }],
      items: [
        {
          id: "x",
          spent_on: "2026-11-10",
          category: "food",
          description: null,
          paid_by: null,
          vet_visit_id: null,
          amount_cents: 700,
          total_cents: 1300,
          pets: [{ pet_id: A, amount_cents: 700 }],
        },
      ],
    });
    expect(o.totalCents).toBe(4700);
    expect(o.items[0]).toMatchObject({ amountCents: 700, totalCents: 1300 });
    expect(parseOverview(null).items).toEqual([]);
  });
});

describe("buildExpensePayload", () => {
  const base: ExpenseDraft = {
    amount: "25,01",
    category: "food",
    petIds: [A, B],
    custom: null,
    date: "2026-11-22",
    paidBy: null,
    description: "  Ração  ",
    documentId: null,
  };

  it("divide 25,01 € por 2 gatos: 12,51 + 12,50", () => {
    const { payload, errors } = buildExpensePayload(base, "2026-11-22");
    expect(errors).toEqual({});
    expect(payload).toEqual({
      amount_cents: 2501,
      category: "food",
      spent_on: "2026-11-22",
      description: "Ração",
      splits: [
        { pet_id: A, amount_cents: 1251 },
        { pet_id: B, amount_cents: 1250 },
      ],
    });
    expect(expenseInputSchema.safeParse(payload).success).toBe(true);
  });

  it("valor, categoria e animais em falta", () => {
    const { payload, errors } = buildExpensePayload(
      { ...base, amount: "", category: null, petIds: [] },
      "2026-11-22",
    );
    expect(payload).toBeNull();
    expect(Object.keys(errors).sort()).toEqual(["amount", "category", "pets"]);
  });

  it("partes ajustadas que não somam: mensagem clara", () => {
    const { payload, errors } = buildExpensePayload(
      { ...base, custom: { [A]: "10,00", [B]: "10,00" } },
      "2026-11-22",
    );
    expect(payload).toBeNull();
    expect(errors.splits).toBe(
      "A soma das partes (20,00 €) não é igual ao total (25,01 €). Faltam 5,01 €.",
    );
  });

  it("partes ajustadas que somam", () => {
    const { payload } = buildExpensePayload(
      { ...base, custom: { [A]: "20", [B]: "5,01" } },
      "2026-11-22",
    );
    expect(payload?.splits).toEqual([
      { pet_id: A, amount_cents: 2000 },
      { pet_id: B, amount_cents: 501 },
    ]);
  });

  it("valor inválido numa parte", () => {
    const { errors } = buildExpensePayload(
      { ...base, custom: { [A]: "abc", [B]: "5" } },
      "2026-11-22",
    );
    expect(errors[`split.${A}`]).toBeDefined();
  });

  it("total bloqueado (partes de outros animais): sem splits", () => {
    const { payload } = buildExpensePayload(
      { ...base, id: A, petIds: [], lockedAmountCents: 1300 },
      "2026-11-22",
    );
    expect(payload).toMatchObject({ id: A, amount_cents: 1300 });
    expect(payload?.splits).toBeUndefined();
  });

  it("data em branco usa hoje", () => {
    const { payload } = buildExpensePayload(
      { ...base, date: "" },
      "2026-11-22",
    );
    expect(payload?.spent_on).toBe("2026-11-22");
  });
});
