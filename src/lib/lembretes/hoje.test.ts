import { describe, expect, it } from "vitest";

import { agoLabel, groupHoje, whenLabel, type OccurrenceRow } from "./hoje";

// 21/11/2026 12:00 em Lisboa (inverno, UTC+0)
const NOW = new Date("2026-11-21T12:00:00Z");

let n = 0;
function row(over: Partial<OccurrenceRow> & { at: string }): OccurrenceRow {
  n += 1;
  const { at, ...rest } = over;
  return {
    id: `o${n}`,
    reminderId: `r${n}`,
    petId: "p1",
    title: "Desparasitação externa",
    scheduledFor: at,
    rrule: null,
    sourceType: "health_event",
    sourceId: null,
    live: true,
    doneAt: null,
    doneBy: null,
    ...rest,
  };
}

describe("groupHoje", () => {
  it("reparte em atraso, hoje e próximos 30 dias", () => {
    const g = groupHoje(
      [
        row({ at: "2026-11-19T09:00:00Z" }),
        row({ at: "2026-11-21T20:00:00Z", sourceType: null }),
        row({ at: "2026-11-22T09:00:00Z" }),
        row({ at: "2026-12-21T09:00:00Z" }),
        row({ at: "2026-12-22T09:00:00Z" }),
      ],
      NOW,
    );
    expect(g.overdue).toHaveLength(1);
    expect(g.today).toHaveLength(1);
    expect(g.upcoming).toHaveLength(2); // +30 dias inclusive, +31 fora
  });

  it("ignora lembretes pausados ou terminados", () => {
    const g = groupHoje(
      [row({ at: "2026-11-19T09:00:00Z", live: false })],
      NOW,
    );
    expect(g.overdue).toHaveLength(0);
  });

  it("recorrentes: só 2 dias de atraso e só a próxima ocorrência", () => {
    const rrule = "FREQ=DAILY;BYHOUR=8";
    const mk = (at: string, reminderId = "m1") =>
      row({ at, rrule, reminderId, sourceType: "medication" });
    const g = groupHoje(
      [
        mk("2026-11-15T08:00:00Z"), // há 6 dias: some
        mk("2026-11-20T08:00:00Z"), // ontem: fica
        mk("2026-11-22T08:00:00Z"),
        mk("2026-11-23T08:00:00Z"),
        mk("2026-11-24T08:00:00Z"),
      ],
      NOW,
    );
    expect(g.overdue).toHaveLength(1);
    expect(g.upcoming).toHaveLength(1);
    expect(g.upcoming[0]!.date).toBe("2026-11-22");
  });

  it("feitos há pouco aparecem com quem fez; os antigos não", () => {
    const g = groupHoje(
      [
        row({
          at: "2026-11-20T09:00:00Z",
          doneAt: "2026-11-21T11:30:00Z",
          doneBy: "u2",
        }),
        row({ at: "2026-11-20T09:00:00Z", doneAt: "2026-11-21T08:00:00Z" }),
      ],
      NOW,
    );
    expect(g.recentlyDone).toHaveLength(1);
    expect(g.recentlyDone[0]!.doneBy).toBe("u2");
    expect(g.overdue).toHaveLength(0);
  });

  it("usa o dia de Lisboa (verão: 23:30 UTC já é o dia seguinte)", () => {
    const g = groupHoje(
      [row({ at: "2026-07-21T23:30:00Z", sourceType: null })],
      new Date("2026-07-22T10:00:00Z"),
    );
    expect(g.today).toHaveLength(1);
  });
});

describe("whenLabel", () => {
  it("escreve a data relativa", () => {
    const [over, today, soon] = [
      groupHoje([row({ at: "2026-11-19T09:00:00Z" })], NOW).overdue[0]!,
      groupHoje([row({ at: "2026-11-21T20:00:00Z", sourceType: null })], NOW)
        .today[0]!,
      groupHoje([row({ at: "2026-12-03T09:00:00Z" })], NOW).upcoming[0]!,
    ];
    expect(whenLabel(over, "2026-11-21")).toBe("há 2 dias · 19/11");
    expect(whenLabel(today, "2026-11-21")).toBe("Hoje às 20:00");
    expect(whenLabel(soon, "2026-11-21")).toBe("daqui a 12 dias · 03/12");
  });
});

describe("agoLabel", () => {
  it("escreve o tempo decorrido", () => {
    const now = Date.parse("2026-11-21T12:00:00Z");
    expect(agoLabel("2026-11-21T12:00:00Z", now)).toBe("agora");
    expect(agoLabel("2026-11-21T11:55:00Z", now)).toBe("há 5 min");
    expect(agoLabel("2026-11-21T10:00:00Z", now)).toBe("há 2 h");
  });
});
