import { describe, expect, it } from "vitest";

import {
  buildExport,
  csvEscape,
  safeName,
  toCsv,
  zipFileName,
  type ExportRaw,
} from "./export-model";

const ME = "11111111-1111-1111-1111-111111111111";
const MAE = "22222222-2222-2222-2222-222222222222";
const PET = "aaaaaaaa-0000-0000-0000-000000000001";
const PET2 = "aaaaaaaa-0000-0000-0000-000000000002";
const T = "2026-11-20T10:00:00+00:00";

function raw(over: Partial<ExportRaw> = {}): ExportRaw {
  const pet = {
    id: PET,
    name: "Nina",
    species: "dog",
    breed: "Podengo",
    sex: "female",
    birth_date: "2020-05-01",
    birth_date_is_estimate: false,
    neutered: true,
    microchip: "123",
    photo_path: `${PET}/foto.webp`,
    color: "laranja",
    notes: null,
    archived_at: null,
    deceased_on: null,
    deceased_precision: "day",
    tribute_text: null,
    clinic_id: "cccccccc-0000-0000-0000-000000000001",
    created_by: ME,
    created_at: T,
    updated_at: T,
  };
  return {
    exportedAt: "2026-11-23T12:00:00Z",
    me: {
      id: ME,
      name: "Pedro",
      email: "pedro@example.com",
      created_at: T,
      reminder_emails: true,
    },
    pets: [pet, { ...pet, id: PET2, name: "Nina", photo_path: null }],
    members: [
      { pet_id: PET, user_id: ME, role: "owner", notify: true },
      { pet_id: PET, user_id: MAE, role: "caregiver", notify: false },
    ],
    names: { [MAE]: "Mãe" },
    clinics: [
      {
        id: "cccccccc-0000-0000-0000-000000000001",
        name: "VetLumiar",
        phone: "217 000 000",
        address: null,
        created_by: ME,
        created_at: T,
        updated_at: T,
      },
    ],
    visits: [],
    weights: [
      {
        id: "w1",
        pet_id: PET,
        measured_on: "2026-11-01",
        weight_kg: 21.5,
        vet_visit_id: null,
        created_by: null,
        created_at: T,
        updated_at: T,
      },
    ],
    events: [
      {
        id: "e1",
        pet_id: PET,
        type: "vaccine",
        occurred_on: "2026-10-01",
        title: "Raiva",
        product: 'Nobivac "Rabies"',
        preset_id: null,
        notes: "Sem reação; tudo bem",
        next_due_on: "2027-10-01",
        remind: true,
        vet_visit_id: null,
        created_by: MAE,
        created_at: T,
        updated_at: T,
      },
      {
        id: "e2",
        pet_id: PET,
        type: "surgery",
        occurred_on: "2026-09-01",
        title: "Cirurgia",
        product: null,
        preset_id: null,
        notes: null,
        next_due_on: null,
        remind: false,
        vet_visit_id: null,
        created_by: ME,
        created_at: T,
        updated_at: T,
      },
    ],
    medications: [],
    reminders: [],
    occurrences: [],
    expenses: [
      {
        id: "x1",
        spent_on: "2026-11-02",
        category: "veterinary",
        amount_cents: 12345,
        description: "=SOMA(A1)",
        paid_by: MAE,
        vet_visit_id: null,
        document_id: null,
        created_by: null,
        created_at: T,
        updated_at: T,
      },
    ],
    splits: [
      {
        expense_id: "x1",
        pet_id: PET,
        amount_cents: 12345,
        created_by: ME,
        created_at: T,
      },
    ],
    documents: [
      {
        id: "d1",
        pet_id: PET,
        kind: "invoice",
        title: "Fatura/Vet: 2026?",
        storage_path: `${PET}/abc.PDF`,
        mime_type: "application/pdf",
        document_date: "2026-11-02",
        vet_visit_id: null,
        created_by: ME,
        created_at: T,
        updated_at: T,
      },
    ],
    memories: [],
    ...over,
  } as ExportRaw;
}

describe("csvEscape / toCsv", () => {
  it("escapa ; aspas e quebras de linha, e mantém acentos", () => {
    expect(csvEscape("a;b")).toBe('"a;b"');
    expect(csvEscape('diz "olá"')).toBe('"diz ""olá"""');
    expect(csvEscape("linha 1\nlinha 2")).toBe('"linha 1\nlinha 2"');
    expect(csvEscape("Mãe — ração")).toBe("Mãe — ração");
    expect(csvEscape(null)).toBe("");
    expect(csvEscape(4.2)).toBe("4,2");
  });

  it("neutraliza fórmulas do Excel", () => {
    expect(csvEscape("=1+1")).toBe("'=1+1");
    expect(csvEscape("@cmd")).toBe("'@cmd");
  });

  it("junta com CRLF e leva BOM para o Excel ler UTF-8", () => {
    const csv = toCsv(["A", "B"], [["1", "ç"]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toBe("﻿A;B\r\n1;ç\r\n");
  });
});

describe("safeName / zipFileName", () => {
  it("tira caracteres proibidos e pontos à frente", () => {
    expect(safeName('Fatura/Vet: "2026"?')).toBe("Fatura-Vet- -2026-");
    expect(safeName("../../x")).toBe("x");
    expect(safeName("   ")).toBe("sem-nome");
  });

  it("nome do ZIP com o dia em Lisboa", () => {
    expect(zipFileName(new Date("2026-11-23T23:30:00Z"))).toBe(
      "patudos-dados-23-11-2026.zip",
    );
    // 00:30 em Lisboa em agosto (UTC+1) já é dia seguinte
    expect(zipFileName(new Date("2026-08-09T23:30:00Z"))).toBe(
      "patudos-dados-10-08-2026.zip",
    );
  });
});

describe("buildExport", () => {
  const b = buildExport(raw());
  const json = b.json as {
    perfil: { email: string };
    animais: { membros: unknown[]; pasta: string }[];
    pesos: { created_by_name: string }[];
    despesas: {
      created_by_name: string;
      paid_by_name: string;
      partes: { animal: string }[];
    }[];
    documentos: { ficheiro: string }[];
  };

  it("exporta as clínicas (sem autor) e a habitual de cada animal", () => {
    const j = b.json as {
      clinicas: Record<string, unknown>[];
      animais: { clinica_habitual_id: string | null }[];
    };
    expect(j.clinicas).toEqual([
      {
        id: "cccccccc-0000-0000-0000-000000000001",
        nome: "VetLumiar",
        telefone: "217 000 000",
        morada: null,
      },
    ]);
    expect(j.animais[0]!.clinica_habitual_id).toBe(
      "cccccccc-0000-0000-0000-000000000001",
    );
  });

  it("dados.json tem o perfil, os animais e os membros só com nome e papel", () => {
    expect(json.perfil.email).toBe("pedro@example.com");
    expect(json.animais).toHaveLength(2);
    expect(json.animais[0]!.membros).toEqual([
      { nome: "Pedro", papel: "dono", eu: true, recebe_lembretes: true },
      { nome: "Mãe", papel: "cuidador", eu: false },
    ]);
    const text = JSON.stringify(json);
    expect(text).not.toContain(MAE);
  });

  it("autores desaparecidos aparecem como «Conta apagada»", () => {
    expect(json.pesos[0]!.created_by_name).toBe("Conta apagada");
    expect(json.despesas[0]!.created_by_name).toBe("Conta apagada");
    expect(json.despesas[0]!.paid_by_name).toBe("Mãe");
    expect(json.despesas[0]!.partes[0]!.animal).toBe("Nina");
  });

  it("pastas por animal com nomes únicos; foto e documento no ZIP", () => {
    expect(b.files.map((f) => f.zipPath)).toEqual([
      "animais/Nina/foto.webp",
      "animais/Nina/documentos/2026-11-02 Fatura-Vet- 2026-.pdf",
    ]);
    expect(json.animais[1]!.pasta).toBe("animais/Nina (2)");
    expect(b.files[1]).toMatchObject({
      bucket: "documentos",
      storagePath: `${PET}/abc.PDF`,
    });
    expect(json.documentos[0]!.ficheiro).toBe(b.files[1]!.zipPath);
  });

  it("tributo: falecimento, texto e memórias (com foto) no JSON e no ZIP", () => {
    const m = buildExport(
      raw({
        pets: [
          {
            ...raw().pets[0]!,
            archived_at: T,
            deceased_on: "2026-09-01",
            deceased_precision: "month",
            tribute_text: "Dormia ao sol.",
          },
        ],
        memories: [
          {
            id: "m1",
            pet_id: PET,
            body: "Esperava-me à porta.",
            photo_path: `${PET}/memorias/a.jpg`,
            created_by: MAE,
            created_at: T,
            updated_at: T,
          },
          {
            id: "m2",
            pet_id: PET,
            body: "Sem foto.",
            photo_path: null,
            created_by: null,
            created_at: T,
            updated_at: T,
          },
        ],
        documents: [],
      }),
    );
    const j = m.json as {
      animais: Record<string, unknown>[];
      memorias: Record<string, unknown>[];
    };
    expect(j.animais[0]).toMatchObject({
      faleceu_em: "2026-09-01",
      faleceu_precisao: "month",
      texto_do_tributo: "Dormia ao sol.",
    });
    expect(j.memorias[0]).toMatchObject({
      animal: "Nina",
      created_by_name: "Mãe",
      ficheiro: "animais/Nina/memorias/2026-11-20 memória.jpg",
    });
    expect(j.memorias[1]).toMatchObject({
      created_by_name: "Conta apagada",
      ficheiro: null,
    });
    expect(JSON.stringify(j)).not.toContain(MAE);
    expect(m.files.map((f) => f.zipPath)).toContain(
      "animais/Nina/memorias/2026-11-20 memória.jpg",
    );
  });

  it("CSV de despesas: euros com vírgula, fórmula neutralizada, quem pagou", () => {
    const csv = b.csvs.find((c) => c.zipPath === "despesas.csv")!.content;
    expect(csv).toContain(
      "02/11/2026;Veterinário;'=SOMA(A1);123,45;Nina (123,45 €);Mãe;Conta apagada",
    );
  });

  it("CSV de pesos e de vacinas (só vacinas e desparasitações, com aspas escapadas)", () => {
    const pesos = b.csvs.find((c) => c.zipPath === "pesos.csv")!.content;
    expect(pesos).toContain("Nina;01/11/2026;21,5;Conta apagada");
    const vac = b.csvs.find(
      (c) => c.zipPath === "vacinas-e-desparasitacoes.csv",
    )!.content;
    expect(vac).toContain(
      'Nina;Vacina;01/10/2026;Raiva;"Nobivac ""Rabies""";01/10/2027;"Sem reação; tudo bem";Mãe',
    );
    expect(vac).not.toContain("Cirurgia");
  });

  it("LEIA-ME em PT-PT menciona os ficheiros", () => {
    expect(b.readme).toContain("dados.json");
    expect(b.readme).toContain("animais/");
    expect(b.readme).toContain("pedro@example.com");
  });
});
