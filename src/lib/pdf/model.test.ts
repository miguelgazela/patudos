import { describe, expect, it } from "vitest";

import {
  buildPdfModel,
  oneYearBefore,
  parsePdfOptions,
  pdfFileName,
  type RawPdfData,
} from "./model";

const TODAY = "2026-11-22";

const raw: RawPdfData = {
  pet: {
    name: "Nina",
    species: "dog",
    sex: "female",
    breed: "Podengo",
    birth_date: "2022-03-14",
    neutered: true,
    microchip: "941000024681357",
  },
  people: [
    { name: "Rita", role: "caregiver" },
    { name: "Miguel", role: "owner" },
  ],
  events: [
    {
      type: "vaccine",
      title: "Antirrábica",
      product: "Nobivac",
      occurred_on: "2026-11-01",
      next_due_on: "2027-11-01",
    },
    {
      type: "vaccine",
      title: "Antirrábica",
      product: null,
      occurred_on: "2025-10-01",
      next_due_on: "2026-10-01",
    },
    {
      type: "vaccine",
      title: "Leptospirose",
      product: null,
      occurred_on: "2024-05-10",
      next_due_on: "2025-05-10",
    },
    {
      type: "deworming_external",
      title: "Advantix",
      product: null,
      occurred_on: "2026-09-01",
      next_due_on: "2026-10-01",
    },
    {
      type: "surgery",
      title: "Dentes",
      product: null,
      occurred_on: "2026-02-01",
      next_due_on: null,
    },
  ],
  medications: [
    {
      name: "Condroprotetor",
      dose: "1 comp.",
      schedule_rrule: "FREQ=DAILY;BYHOUR=9;BYMINUTE=0",
      starts_on: "2026-10-01",
      ends_on: null,
    },
    {
      name: "Antibiótico",
      dose: null,
      schedule_rrule: null,
      starts_on: "2026-06-01",
      ends_on: "2026-06-10",
    },
  ],
  weights: [
    { measured_on: "2024-01-01", weight_kg: 10 },
    { measured_on: "2026-06-01", weight_kg: 12 },
    { measured_on: "2026-11-01", weight_kg: 12.4 },
  ],
  visits: [
    {
      visited_on: "2026-11-01",
      reason: "Vacinação",
      vet_name: null,
      clinic: null,
    },
    {
      visited_on: "2026-06-01",
      reason: "Revisão",
      vet_name: "Dra. Inês",
      clinic: "VetLumiar",
    },
    {
      visited_on: "2024-01-01",
      reason: "Antiga",
      vet_name: "Dr. Velho",
      clinic: null,
    },
  ],
};

describe("buildPdfModel", () => {
  it("«Tudo» + último ano: ordena e formata em PT-PT", () => {
    const m = buildPdfModel(raw, { include: "all", period: "year" }, TODAY);
    expect(m.header.subtitle).toBe("Cadela · Podengo");
    expect(m.header.facts.map((f) => f.label)).toEqual([
      "Nascimento",
      "Sexo",
      "Esterilização",
      "Chip",
    ]);
    expect(m.header.facts[0]!.value).toBe("14/03/2022 (4 anos)");
    expect(m.header.facts[2]!.value).toBe("Esterilizada");
    expect(m.vaccines.map((v) => v.date)).toEqual(["01/11/2026", "10/05/2024"]);
    expect(m.vaccines[0]).toMatchObject({
      title: "Antirrábica",
      product: "Nobivac",
      nextDue: "01/11/2027",
    });
    expect(m.dewormings[0]!.title).toBe("Externa · Advantix");
    expect(m.otherEvents[0]!.title).toBe("Cirurgia · Dentes");
    expect(m.medications).toEqual([
      {
        name: "Condroprotetor",
        dose: "1 comp.",
        frequency: "1× por dia · 09:00",
        until: "Contínua",
      },
    ]);
    expect(m.weights!.rows.map((w) => w.value)).toEqual(["12,4 kg", "12 kg"]);
    expect(m.visits!.map((v) => v.date)).toEqual(["01/11/2026", "01/06/2026"]);
    expect(m.visits![1]!.vet).toBe("VetLumiar · Dra. Inês");
    expect(m.periodLabel).toBe("Historial desde 22/11/2025");
  });

  it("mantém a dose mais recente de cada vacina mesmo fora do período", () => {
    const m = buildPdfModel(raw, { include: "all", period: "year" }, TODAY);
    // Leptospirose (2024) é a única dose dessa vacina: fica; a Antirrábica antiga sai.
    expect(m.vaccines.map((v) => v.title)).toEqual([
      "Antirrábica",
      "Leptospirose",
    ]);
  });

  it("«Tudo» + historial completo inclui doses e consultas antigas", () => {
    const m = buildPdfModel(raw, { include: "all", period: "all" }, TODAY);
    expect(m.vaccines).toHaveLength(3);
    expect(m.vaccines[0]!.date).toBe("01/11/2026");
    expect(m.weights!.series.map((s) => s.kg)).toEqual([10, 12, 12.4]);
    expect(m.visits).toHaveLength(3);
    expect(m.periodLabel).toBe("Historial completo");
  });

  it("«Só vacinas» deixa de fora medicação, peso, consultas e outros", () => {
    const m = buildPdfModel(raw, { include: "vaccines", period: "all" }, TODAY);
    expect(m.vaccines.length).toBeGreaterThan(0);
    expect(m.dewormings).toHaveLength(1);
    expect(m.medications).toBeNull();
    expect(m.weights).toBeNull();
    expect(m.visits).toBeNull();
    expect(m.otherEvents).toEqual([]);
  });

  it("contactos: clínica da consulta mais recente que a tenha; pessoas com dono primeiro", () => {
    const m = buildPdfModel(raw, { include: "all", period: "all" }, TODAY);
    expect(m.contacts.clinic).toEqual({
      name: "VetLumiar · Dra. Inês",
      phone: null,
      address: null,
    });
    expect(m.contacts.people).toEqual([
      { name: "Miguel", role: "Responsável" },
      { name: "Rita", role: "Cuidador" },
    ]);
  });

  it("sem dados: secções vazias e sem veterinário", () => {
    const m = buildPdfModel(
      {
        ...raw,
        events: [],
        medications: [],
        weights: [],
        visits: [],
        pet: {
          ...raw.pet,
          birth_date: null,
          microchip: null,
          neutered: null,
          sex: null,
        },
      },
      { include: "all", period: "year" },
      TODAY,
    );
    expect(m.contacts.clinic).toBeNull();
    expect(m.vaccines).toEqual([]);
    expect(m.header.facts).toEqual([]);
    expect(m.weights!.rows).toEqual([]);
  });
});

describe("helpers", () => {
  it("oneYearBefore trata 29 de fevereiro", () => {
    expect(oneYearBefore("2028-02-29")).toBe("2027-02-28");
    expect(oneYearBefore("2026-11-22")).toBe("2025-11-22");
  });

  it("parsePdfOptions usa os valores por defeito quando são inválidos", () => {
    expect(parsePdfOptions(new URLSearchParams("incluir=x&periodo=y"))).toEqual(
      { include: "all", period: "year" },
    );
    expect(
      parsePdfOptions(new URLSearchParams("incluir=vaccines&periodo=all")),
    ).toEqual({ include: "vaccines", period: "all" });
  });

  it("pdfFileName", () => {
    expect(pdfFileName("Nina")).toBe("ficha-nina.pdf");
    expect(pdfFileName("Tótó da Ação")).toBe("ficha-toto-da-acao.pdf");
    expect(pdfFileName("🐶")).toBe("ficha-animal.pdf");
  });

  it("clínica habitual com telefone e morada tem prioridade sobre o historial", () => {
    const withClinic = {
      ...raw,
      clinic: {
        name: " Clínica Patinhas ",
        phone: "217 000 000",
        address: null,
      },
    };
    const m = buildPdfModel(
      withClinic,
      { include: "all", period: "all" },
      TODAY,
    );
    expect(m.contacts.clinic).toEqual({
      name: "Clínica Patinhas",
      phone: "217 000 000",
      address: null,
    });
  });

  it("consultas com clínica guardada mostram o nome da clínica", () => {
    const m = buildPdfModel(
      {
        ...raw,
        visits: [
          {
            visited_on: "2026-11-01",
            reason: "Revisão",
            vet_name: null,
            clinic: null,
            clinics: { name: "Clínica Patinhas", phone: null, address: null },
          },
        ],
      },
      { include: "all", period: "all" },
      TODAY,
    );
    expect(m.visits![0]!.vet).toBe("Clínica Patinhas");
    expect(m.contacts.clinic?.name).toBe("Clínica Patinhas");
  });
});
