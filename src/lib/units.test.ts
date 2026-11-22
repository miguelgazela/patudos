import { describe, expect, it } from "vitest";

import { formatISODate, todayISO } from "./dates";
import { formatCents, formatKg, parseEuroToCents, parseKg } from "./units";

describe("euros e cêntimos", () => {
  it("lê vírgula e ponto", () => {
    expect(parseEuroToCents("45")).toBe(4500);
    expect(parseEuroToCents("45,5")).toBe(4550);
    expect(parseEuroToCents("45,50 €")).toBe(4550);
    expect(parseEuroToCents("0.05")).toBe(5);
    expect(parseEuroToCents("1 234,56")).toBe(123456);
  });
  it("recusa valores inválidos", () => {
    for (const bad of ["", "abc", "-3", "1,234", "1,2,3", ","]) {
      expect(parseEuroToCents(bad)).toBeNull();
    }
  });
  it("apresenta como 45,00 €", () => {
    expect(formatCents(4500)).toBe("45,00 €");
    expect(formatCents(123456)).toMatch(/^1\s234,56 €$/);
    expect(formatCents(5)).toBe("0,05 €");
  });
});

describe("kg", () => {
  it("lê com vírgula PT", () => {
    expect(parseKg("12,4")).toBe(12.4);
    expect(parseKg("12.40 kg")).toBe(12.4);
    expect(parseKg("8")).toBe(8);
  });
  it("recusa zero, negativos e demasiadas casas", () => {
    for (const bad of ["", "0", "0,0", "-1", "12,345", "x"]) {
      expect(parseKg(bad)).toBeNull();
    }
  });
  it("apresenta com vírgula", () => {
    expect(formatKg(12.4)).toBe("12,4 kg");
    expect(formatKg(8)).toBe("8 kg");
  });
});

describe("datas", () => {
  it("formata dd/MM/yyyy", () => {
    expect(formatISODate("2026-11-21")).toBe("21/11/2026");
  });
  it("hoje é em Lisboa", () => {
    // 23:30 UTC de Verão já é o dia seguinte em Lisboa.
    expect(todayISO(new Date("2026-07-10T23:30:00Z"))).toBe("2026-07-11");
    expect(todayISO(new Date("2026-12-10T23:30:00Z"))).toBe("2026-12-10");
  });
});
