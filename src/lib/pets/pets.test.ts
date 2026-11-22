import { describe, expect, it } from "vitest";

import { approxBirthDate, approxFromBirthDate, formatAge } from "./age";
import { nextFreeColor } from "./constants";
import { sharedLine, speciesLabel } from "./labels";
import { petSchema } from "./schemas";

const now = new Date("2026-11-22T12:00:00Z");

describe("formatAge", () => {
  it("anos e meses em PT", () => {
    expect(formatAge("2023-11-22", now)).toBe("3 anos");
    expect(formatAge("2025-11-21", now)).toBe("1 ano");
    expect(formatAge("2026-03-10", now)).toBe("8 meses");
    expect(formatAge("2026-10-22", now)).toBe("1 mês");
    expect(formatAge("2026-11-10", now)).toBe("Menos de 1 mês");
  });
  it("ainda não fez o aniversário", () => {
    expect(formatAge("2023-11-23", now)).toBe("2 anos");
  });
});

describe("idade aproximada", () => {
  it("calcula a data e volta ao valor", () => {
    expect(approxBirthDate(1, "years", now)).toBe("2025-11-22");
    expect(approxBirthDate(8, "months", now)).toBe("2026-03-22");
    expect(approxFromBirthDate("2023-11-22", now)).toEqual({
      value: 3,
      unit: "years",
    });
    expect(approxFromBirthDate("2026-03-22", now)).toEqual({
      value: 8,
      unit: "months",
    });
  });
  it("não passa do fim do mês", () => {
    expect(approxBirthDate(9, "months", new Date("2026-11-30T12:00:00Z"))).toBe(
      "2026-02-28",
    );
  });
});

describe("rótulos", () => {
  it("espécie conforme o sexo", () => {
    expect(speciesLabel("dog", "female")).toBe("Cadela");
    expect(speciesLabel("dog", null)).toBe("Cão");
    expect(speciesLabel("cat", "female")).toBe("Gata");
    expect(speciesLabel("cat", "male")).toBe("Gato");
  });
  it("linha de partilha", () => {
    const m = [
      { user_id: "a", role: "owner", name: "Pedro" },
      { user_id: "b", role: "caregiver", name: "Mãe" },
      { user_id: "c", role: "caregiver", name: "Pai" },
    ];
    expect(sharedLine(m, "a")).toBe("Partilhado com Mãe, Pai");
    expect(sharedLine(m.slice(0, 1), "a")).toBe("Só tu");
    expect(sharedLine(m, "b")).toBe("Cuidas com Pedro, Pai");
  });
  it("próxima cor livre", () => {
    expect(nextFreeColor([])).toBe("laranja");
    expect(nextFreeColor(["laranja", "azul"])).toBe("uva");
  });
});

describe("petSchema", () => {
  const base = {
    name: " Bolacha ",
    species: "dog",
    sex: "",
    neutered: "",
    color: "relva",
    breed: "",
    microchip: "",
    notes: "",
  };
  it("aceita o mínimo", () => {
    const r = petSchema.safeParse(base);
    expect(r.success && r.data).toMatchObject({
      name: "Bolacha",
      sex: null,
      neutered: null,
      birth_date: null,
      birth_date_is_estimate: false,
    });
  });
  it("idade aproximada marca estimativa", () => {
    const r = petSchema.safeParse({
      ...base,
      birth_mode: "approx",
      approx_value: "2",
      approx_unit: "years",
    });
    expect(r.success && r.data.birth_date_is_estimate).toBe(true);
  });
  it("rejeita nome vazio, data futura e cor inválida", () => {
    expect(petSchema.safeParse({ ...base, name: " " }).success).toBe(false);
    expect(
      petSchema.safeParse({
        ...base,
        birth_mode: "exact",
        birth_date: "2999-01-01",
      }).success,
    ).toBe(false);
    expect(petSchema.safeParse({ ...base, color: "rosa" }).success).toBe(false);
  });
});
