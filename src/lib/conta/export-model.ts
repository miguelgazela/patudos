import type { Tables } from "@/lib/database.types";
import { formatISODate, lisbonDate } from "@/lib/dates";
import { EVENT_TYPE_LABEL, EXPENSE_CATEGORY_LABEL } from "@/lib/ficha/labels";

import { DELETED_ACCOUNT } from "./labels";

/**
 * Modelo da exportação («Exportar os meus dados»): recebe o que o utilizador pode ver
 * (linhas lidas com a sessão dele, por isso já respeitam o RLS) e devolve o `dados.json`,
 * os CSVs, a lista de ficheiros para o ZIP e o LEIA-ME. É puro: o servidor lê a BD e o
 * cliente monta o ZIP.
 */

export type ExportRaw = {
  /** Instante da exportação (ISO). */
  exportedAt: string;
  me: Pick<
    Tables<"profiles">,
    "id" | "name" | "email" | "created_at" | "reminder_emails"
  >;
  pets: Tables<"pets">[];
  members: { pet_id: string; user_id: string; role: string; notify: boolean }[];
  /** Nome de cada pessoa visível (id → nome). */
  names: Record<string, string>;
  visits: Tables<"vet_visits">[];
  weights: Tables<"weights">[];
  events: Tables<"health_events">[];
  medications: Tables<"medications">[];
  reminders: Tables<"reminders">[];
  occurrences: Tables<"reminder_occurrences">[];
  expenses: Tables<"expenses">[];
  splits: Tables<"expense_splits">[];
  documents: Tables<"documents">[];
};

export type ExportFile = {
  /** Caminho dentro do ZIP. */
  zipPath: string;
  bucket: "fotos" | "documentos";
  storagePath: string;
};

export type ExportBundle = {
  json: unknown;
  csvs: { zipPath: string; content: string }[];
  readme: string;
  files: ExportFile[];
};

// ---------------------------------------------------------------------------
// CSV (Excel em PT: separador «;», vírgula decimal, UTF-8 com BOM)
// ---------------------------------------------------------------------------

export type CsvCell = string | number | null | undefined;

/** Texto que o Excel interpretaria como fórmula leva um apóstrofo à frente. */
const FORMULA = /^[=+\-@\t\r]/;

export function csvEscape(cell: CsvCell): string {
  if (cell === null || cell === undefined) return "";
  let text =
    typeof cell === "number"
      ? String(cell).replace(".", ",")
      : cell.replace(/\r\n|\r/g, "\n");
  if (typeof cell === "string" && FORMULA.test(text)) text = `'${text}`;
  return /[;"\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: string[], rows: CsvCell[][]): string {
  const lines = [header, ...rows].map((r) => r.map(csvEscape).join(";"));
  return `﻿${lines.join("\r\n")}\r\n`;
}

const euros = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");

// ---------------------------------------------------------------------------
// Nomes de ficheiros e pastas
// ---------------------------------------------------------------------------

/** Nome seguro para ficheiros e pastas num ZIP (sem `/ \ : * ? " < > |`, sem pontos à frente). */
export function safeName(input: string, fallback = "sem-nome"): string {
  const cleaned = input
    .replace(/[\u0000-\u001f\u007f/\\:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[.\s-]+/, "")
    .replace(/[.\s]+$/, "")
    .slice(0, 80)
    .trim();
  return cleaned || fallback;
}

/** Dá nomes únicos (mesmo ignorando maiúsculas): «Nina», «Nina (2)», … */
function uniqueName(name: string, used: Set<string>): string {
  let candidate = name;
  for (let n = 2; used.has(candidate.toLowerCase()); n++) {
    candidate = `${name} (${n})`;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

function extensionOf(path: string): string {
  const m = /\.([A-Za-z0-9]{1,5})$/.exec(path);
  return m?.[1] ? `.${m[1].toLowerCase()}` : "";
}

/** `patudos-dados-dd-MM-yyyy.zip`, com o dia em Lisboa. */
export function zipFileName(now: Date = new Date()): string {
  const [y, m, d] = lisbonDate(now).split("-");
  return `patudos-dados-${d}-${m}-${y}.zip`;
}

// ---------------------------------------------------------------------------
// Construção
// ---------------------------------------------------------------------------

export function buildExport(raw: ExportRaw): ExportBundle {
  const { me } = raw;
  const who = (id: string | null): string => {
    if (!id) return DELETED_ACCOUNT;
    if (id === me.id) return me.name || "Tu";
    return raw.names[id] ?? "Outra pessoa";
  };

  // Pastas por animal (nomes únicos)
  const used = new Set<string>();
  const folder = new Map<string, string>();
  for (const p of raw.pets) {
    folder.set(p.id, `animais/${uniqueName(safeName(p.name, "animal"), used)}`);
  }
  const petName = (id: string) => raw.pets.find((p) => p.id === id)?.name ?? "";

  // Ficheiros: foto de cada animal e documentos
  const files: ExportFile[] = [];
  const photoOf = new Map<string, string>();
  for (const p of raw.pets) {
    if (!p.photo_path) continue;
    const zipPath = `${folder.get(p.id)}/foto${extensionOf(p.photo_path) || ".jpg"}`;
    photoOf.set(p.id, zipPath);
    files.push({ zipPath, bucket: "fotos", storagePath: p.photo_path });
  }
  const docUsed = new Map<string, Set<string>>();
  const docZipPath = new Map<string, string>();
  for (const d of raw.documents) {
    const dir = folder.get(d.pet_id);
    if (!dir) continue;
    const names = docUsed.get(d.pet_id) ?? new Set<string>();
    docUsed.set(d.pet_id, names);
    const ext = extensionOf(d.storage_path);
    const when = d.document_date ?? d.created_at.slice(0, 10);
    const base = uniqueName(safeName(`${when} ${d.title}`, "documento"), names);
    const zipPath = `${dir}/documentos/${base}${ext}`;
    docZipPath.set(d.id, zipPath);
    files.push({ zipPath, bucket: "documentos", storagePath: d.storage_path });
  }

  // dados.json
  const stripIds = <T extends Record<string, unknown>>(
    row: T,
    fields: (keyof T)[],
  ) => {
    const out: Record<string, unknown> = { ...row };
    for (const f of fields) {
      delete out[f as string];
      out[`${String(f)}_name`] = who((row[f] as string | null) ?? null);
    }
    return out;
  };

  const json = {
    exportado_em: raw.exportedAt,
    perfil: {
      nome: me.name,
      email: me.email,
      conta_criada_em: me.created_at,
      emails_de_lembrete: me.reminder_emails,
    },
    animais: raw.pets.map((p) => ({
      id: p.id,
      nome: p.name,
      especie: p.species,
      raca: p.breed,
      sexo: p.sex,
      data_de_nascimento: p.birth_date,
      data_de_nascimento_estimada: p.birth_date_is_estimate,
      esterilizado: p.neutered,
      chip: p.microchip,
      cor: p.color,
      notas: p.notes,
      arquivado_em: p.archived_at,
      criado_em: p.created_at,
      foto: photoOf.get(p.id) ?? null,
      pasta: folder.get(p.id) ?? null,
      membros: raw.members
        .filter((m) => m.pet_id === p.id)
        .map((m) => ({
          nome: who(m.user_id),
          papel: m.role === "owner" ? "dono" : "cuidador",
          eu: m.user_id === me.id,
          ...(m.user_id === me.id ? { recebe_lembretes: m.notify } : {}),
        })),
    })),
    consultas: raw.visits.map((v) => stripIds(v, ["created_by"])),
    pesos: raw.weights.map((w) => stripIds(w, ["created_by"])),
    eventos_de_saude: raw.events.map((e) => stripIds(e, ["created_by"])),
    medicacao: raw.medications.map((m) => stripIds(m, ["created_by"])),
    lembretes: raw.reminders.map((r) => stripIds(r, ["created_by"])),
    ocorrencias_de_lembretes: raw.occurrences.map((o) =>
      stripIds(o, ["done_by"]),
    ),
    despesas: raw.expenses.map((e) => ({
      ...stripIds(e, ["created_by", "paid_by"]),
      partes: raw.splits
        .filter((s) => s.expense_id === e.id)
        .map((s) => ({
          pet_id: s.pet_id,
          animal: petName(s.pet_id),
          amount_cents: s.amount_cents,
        })),
    })),
    documentos: raw.documents.map((d) => ({
      ...stripIds(d, ["created_by"]),
      ficheiro: docZipPath.get(d.id) ?? null,
    })),
  };

  // CSVs
  const expenses = [...raw.expenses].sort((a, b) =>
    b.spent_on.localeCompare(a.spent_on),
  );
  const despesas = toCsv(
    [
      "Data",
      "Categoria",
      "Descrição",
      "Valor total (€)",
      "Animais",
      "Pago por",
      "Registado por",
    ],
    expenses.map((e) => {
      const parts = raw.splits.filter((s) => s.expense_id === e.id);
      return [
        formatISODate(e.spent_on),
        EXPENSE_CATEGORY_LABEL[e.category] ?? e.category,
        e.description,
        euros(e.amount_cents),
        parts
          .map((s) => `${petName(s.pet_id)} (${euros(s.amount_cents)} €)`)
          .join(", "),
        who(e.paid_by),
        who(e.created_by),
      ];
    }),
  );

  const pesos = toCsv(
    ["Animal", "Data", "Peso (kg)", "Registado por"],
    [...raw.weights]
      .sort(
        (a, b) =>
          petName(a.pet_id).localeCompare(petName(b.pet_id), "pt") ||
          b.measured_on.localeCompare(a.measured_on),
      )
      .map((w) => [
        petName(w.pet_id),
        formatISODate(w.measured_on),
        Number(w.weight_kg),
        who(w.created_by),
      ]),
  );

  const vacinas = toCsv(
    [
      "Animal",
      "Tipo",
      "Data",
      "Nome",
      "Produto",
      "Próxima data",
      "Notas",
      "Registado por",
    ],
    raw.events
      .filter((e) => e.type === "vaccine" || e.type.startsWith("deworming"))
      .sort(
        (a, b) =>
          petName(a.pet_id).localeCompare(petName(b.pet_id), "pt") ||
          b.occurred_on.localeCompare(a.occurred_on),
      )
      .map((e) => [
        petName(e.pet_id),
        EVENT_TYPE_LABEL[e.type] ?? e.type,
        formatISODate(e.occurred_on),
        e.title,
        e.product,
        e.next_due_on ? formatISODate(e.next_due_on) : null,
        e.notes,
        who(e.created_by),
      ]),
  );

  const csvs = [
    { zipPath: "despesas.csv", content: despesas },
    { zipPath: "pesos.csv", content: pesos },
    { zipPath: "vacinas-e-desparasitacoes.csv", content: vacinas },
  ];

  return {
    json,
    csvs,
    readme: buildReadme(raw, files),
    files,
  };
}

function buildReadme(raw: ExportRaw, files: ExportFile[]): string {
  const when = new Intl.DateTimeFormat("pt-PT", {
    timeZone: "Europe/Lisbon",
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(raw.exportedAt));
  const docs = raw.documents.length;
  return [
    "PATUDOS: OS TEUS DADOS",
    "======================",
    "",
    `Exportado em ${when} para ${raw.me.email}.`,
    "",
    "O que tem este ficheiro",
    "-----------------------",
    "dados.json",
    "  Todos os dados a que tens acesso: o teu perfil, os animais (teus e",
    "  partilhados contigo), as pessoas de cada animal (só nomes e papéis),",
    "  consultas, pesos, vacinas e outros eventos de saúde, medicação,",
    "  lembretes e as vezes em que tocaram, despesas (com a parte de cada",
    "  animal) e os dados dos documentos. Está em JSON, um formato que",
    "  qualquer programa consegue ler.",
    "",
    "despesas.csv, pesos.csv, vacinas-e-desparasitacoes.csv",
    "  As mesmas informações em tabela, para abrires no Excel, Numbers ou",
    "  Google Sheets. Separador «;», datas dd/MM/yyyy, valores com vírgula.",
    "",
    "animais/",
    "  Uma pasta por animal, com a foto e a subpasta «documentos» com os",
    `  ficheiros que carregaste ou que foram carregados para esse animal`,
    `  (${files.length} ficheiro${files.length === 1 ? "" : "s"} no total, ${docs} documento${docs === 1 ? "" : "s"}).`,
    "",
    "O que NÃO está incluído",
    "-----------------------",
    "- Dados de animais a que já não tens acesso.",
    "- Os dados técnicos das notificações do teu telemóvel e o código secreto",
    "  do teu calendário: servem só para a app funcionar.",
    "- Informação de outras pessoas além do nome e do papel nos animais que",
    "  partilham contigo.",
    "",
    "Quem registou o quê",
    `Quando alguém apagou a conta, os registos que fez ficam no animal e aparecem`,
    `como «${DELETED_ACCOUNT}».`,
    "",
    "Dúvidas: patudos@miguelgazela.com",
    "",
  ].join("\r\n");
}
