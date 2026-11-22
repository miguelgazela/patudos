import { describe, expect, it } from "vitest";

import { greeting, longDate } from "./dates";

describe("longDate", () => {
  it("escreve a data por extenso em Europe/Lisbon", () => {
    expect(longDate(new Date("2026-11-21T12:00:00Z"))).toBe(
      "Sábado, 21 de novembro",
    );
  });
  it("usa a data de Lisboa, não a UTC", () => {
    // 21/11 23:30 UTC ainda é dia 21 em Lisboa (UTC+0 no inverno)…
    expect(longDate(new Date("2026-11-21T23:30:00Z"))).toBe(
      "Sábado, 21 de novembro",
    );
    // …e em julho (UTC+1) já é dia 22.
    expect(longDate(new Date("2026-07-21T23:30:00Z"))).toBe(
      "Quarta-feira, 22 de julho",
    );
  });
});

describe("greeting", () => {
  it("muda ao longo do dia", () => {
    expect(greeting(new Date("2026-11-21T09:00:00Z"))).toBe("Bom dia");
    expect(greeting(new Date("2026-11-21T15:00:00Z"))).toBe("Boa tarde");
    expect(greeting(new Date("2026-11-21T22:00:00Z"))).toBe("Boa noite");
  });
});
