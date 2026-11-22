import { describe, expect, it } from "vitest";

import { dueLabel, dueStatus, upcomingDates } from "./due";

const today = "2026-11-22";

describe("estado das próximas datas", () => {
  it("em atraso, hoje, em breve e mais tarde", () => {
    expect(dueStatus("2026-11-21", today)).toBe("overdue");
    expect(dueStatus("2026-11-22", today)).toBe("today");
    expect(dueStatus("2026-12-06", today)).toBe("soon"); // +14
    expect(dueStatus("2026-12-07", today)).toBe("later"); // +15
  });

  it("legendas em português", () => {
    expect(dueLabel("2026-11-19", today)).toBe("Em atraso há 3 dias");
    expect(dueLabel("2026-11-21", today)).toBe("Em atraso há 1 dia");
    expect(dueLabel("2026-11-22", today)).toBe("Hoje");
    expect(dueLabel("2026-11-23", today)).toBe("Amanhã");
    expect(dueLabel("2026-12-04", today)).toBe("Em 12 dias");
    expect(dueLabel("2027-04-22", today)).toBe("Em 5 meses");
  });
});

describe("upcomingDates", () => {
  const ev = (
    id: string,
    title: string,
    occurred_on: string,
    next_due_on: string | null,
    type = "vaccine",
  ) => ({ id, type, title, occurred_on, next_due_on });

  it("uma dose nova substitui a data prevista da anterior", () => {
    const list = upcomingDates(
      [
        ev("2", "Antirrábica", "2026-11-01", "2027-11-01"),
        ev("1", "Antirrábica", "2025-11-01", "2026-11-01"),
      ],
      today,
    );
    expect(list.map((d) => d.id)).toEqual(["2"]);
    expect(list[0]!.status).toBe("later");
  });

  it("ordena pela data e ignora registos sem próxima data", () => {
    const list = upcomingDates(
      [
        ev("a", "Antirrábica", "2026-01-01", "2027-01-01"),
        ev(
          "b",
          "Desparasitação externa",
          "2026-10-01",
          "2026-11-01",
          "deworming_external",
        ),
        ev("c", "Cirurgia", "2026-09-01", null, "surgery"),
        ev("d", "Polivalente", "2026-02-01", "2026-11-22"),
      ],
      today,
    );
    expect(list.map((d) => [d.id, d.status])).toEqual([
      ["b", "overdue"],
      ["d", "today"],
      ["a", "later"],
    ]);
  });
});
