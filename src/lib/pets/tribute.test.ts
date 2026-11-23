import { describe, expect, it } from "vitest";

import {
  convertPartial,
  formatPartialDate,
  isBeforeBirth,
  lifeSpan,
  parseOptionalText,
  parsePartialDate,
} from "./tribute";

const TODAY = "2026-11-24";

describe("parsePartialDate", () => {
  it("dia exato", () => {
    expect(parsePartialDate("2026-09-12", "day", TODAY)).toEqual({
      ok: true,
      date: "2026-09-12",
      precision: "day",
    });
  });
  it("mês e ano guardam o primeiro dia do mês", () => {
    expect(parsePartialDate("2026-09", "month", TODAY)).toEqual({
      ok: true,
      date: "2026-09-01",
      precision: "month",
    });
  });
  it("só o ano guarda 1 de janeiro", () => {
    expect(parsePartialDate("2019", "year", TODAY)).toMatchObject({
      ok: true,
      date: "2019-01-01",
    });
  });
  it("este mês e este ano ainda não são futuro", () => {
    expect(parsePartialDate("2026-11", "month", TODAY).ok).toBe(true);
    expect(parsePartialDate("2026", "year", TODAY).ok).toBe(true);
  });
  it("recusa futuro, datas impossíveis e lixo", () => {
    expect(parsePartialDate("2026-12", "month", TODAY)).toMatchObject({
      ok: false,
      message: "A data não pode ser no futuro.",
    });
    expect(parsePartialDate("2026-11-25", "day", TODAY).ok).toBe(false);
    expect(parsePartialDate("2026-02-30", "day", TODAY).ok).toBe(false);
    expect(parsePartialDate("2026-13", "month", TODAY).ok).toBe(false);
    expect(parsePartialDate("26", "year", TODAY).ok).toBe(false);
    expect(parsePartialDate("", "day", TODAY).ok).toBe(false);
    expect(parsePartialDate("2026", "semana", TODAY).ok).toBe(false);
  });
});

describe("formatPartialDate / lifeSpan", () => {
  it("formata em PT-PT", () => {
    expect(formatPartialDate("2026-09-12", "day")).toBe("12/09/2026");
    expect(formatPartialDate("2026-09-01", "month")).toBe("setembro de 2026");
    expect(formatPartialDate("2026-01-01", "year")).toBe("2026");
  });
  it("«2012 – 2026», ou só o ano sem nascimento", () => {
    expect(lifeSpan("2012-05-10", "2026-09-01")).toBe("2012 – 2026");
    expect(lifeSpan(null, "2026-09-01")).toBe("2026");
  });
});

describe("convertPartial / isBeforeBirth", () => {
  it("troca de precisão sem inventar", () => {
    expect(convertPartial("2026-09-12", "month")).toBe("2026-09");
    expect(convertPartial("2026-09-12", "year")).toBe("2026");
    expect(convertPartial("2026", "month")).toBe("");
    expect(convertPartial("2026-09", "day")).toBe("");
  });
  it("falecimento não pode ser antes do nascimento (na precisão dada)", () => {
    expect(isBeforeBirth("2012-05-10", "2012-05-01", "month")).toBe(false);
    expect(isBeforeBirth("2012-05-10", "2012-05-01", "day")).toBe(true);
    expect(isBeforeBirth("2012-05-10", "2011-01-01", "year")).toBe(true);
  });
});

describe("parseOptionalText", () => {
  it("vazio vira null; demasiado grande falha", () => {
    expect(parseOptionalText("  ", 5, "x")).toEqual({ ok: true, value: null });
    expect(parseOptionalText(" olá ", 5, "x")).toEqual({
      ok: true,
      value: "olá",
    });
    expect(parseOptionalText("123456", 5, "x")).toEqual({
      ok: false,
      message: "x",
    });
  });
});
