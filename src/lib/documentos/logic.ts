import { DOCUMENT_KIND_LABEL } from "@/lib/ficha/labels";

export const DOCUMENT_KINDS = [
  "invoice",
  "health_record",
  "insurance",
  "microchip",
  "other",
] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export function isDocumentKind(v: unknown): v is DocumentKind {
  return (DOCUMENT_KINDS as readonly unknown[]).includes(v);
}

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
/** Lado maior das imagens guardadas: legível como documento, não como avatar. */
export const DOCUMENT_IMAGE_SIDE = 2048;

const KIND_TITLE: Record<DocumentKind, string> = {
  invoice: "Fatura",
  health_record: "Boletim sanitário",
  insurance: "Seguro",
  microchip: "Chip",
  other: "Documento",
};

/** «Boletim sanitário da Nina»; o artigo segue o sexo, ou «de» se não se sabe. */
export function suggestTitle(
  kind: DocumentKind,
  petName: string | null | undefined,
  sex?: "female" | "male" | null,
): string {
  const base = KIND_TITLE[kind];
  const name = petName?.trim();
  if (!name) return base;
  const de = sex === "female" ? "da" : sex === "male" ? "do" : "de";
  return `${base} ${de} ${name}`;
}

export type FileCheck =
  { ok: true; kind: "pdf" | "image" } | { ok: false; message: string };

const HEIC = /\.(heic|heif)$/i;

export function isHeic(file: { type: string; name: string }): boolean {
  return /^image\/hei[cf]$/i.test(file.type) || HEIC.test(file.name);
}

/** Valida o ficheiro escolhido (antes de comprimir): tipo e tamanho. */
export function checkDocumentFile(file: {
  type: string;
  name: string;
  size: number;
}): FileCheck {
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  if (isPdf) {
    if (file.size > MAX_DOCUMENT_BYTES) {
      return {
        ok: false,
        message: "O PDF é demasiado grande (máximo 10 MB).",
      };
    }
    return { ok: true, kind: "pdf" };
  }
  if (file.type.startsWith("image/") || isHeic(file)) {
    return { ok: true, kind: "image" };
  }
  return { ok: false, message: "Escolhe uma foto ou um PDF." };
}

export const HEIC_ERROR =
  "Não conseguimos abrir esta foto (HEIC). Tira a foto de novo ou escolhe outra.";
export const IMAGE_ERROR = "Não conseguimos usar esse ficheiro. Tenta outro.";

export const DOCUMENT_CHIPS: { kind: DocumentKind; label: string }[] =
  DOCUMENT_KINDS.map((kind) => ({ kind, label: DOCUMENT_KIND_LABEL[kind]! }));

/** Sem acentos e em minúsculas: «Seguro» encontra «seguro» e «Apólice» encontra «apolice». */
export function normalizeText(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export type ListedDocument = {
  id: string;
  petId: string;
  petName: string;
  kind: string;
  title: string;
  date: string;
};

/** Filtro por tipo (vazio = todos) e pesquisa por título ou nome do animal. */
export function filterDocuments<T extends ListedDocument>(
  docs: T[],
  opts: { kind?: string | null; query?: string; petId?: string | null },
): T[] {
  const q = normalizeText(opts.query ?? "");
  const words = q ? q.split(/\s+/) : [];
  return docs.filter((d) => {
    if (opts.kind && d.kind !== opts.kind) return false;
    if (opts.petId && d.petId !== opts.petId) return false;
    if (!words.length) return true;
    const hay = normalizeText(
      `${d.title} ${d.petName} ${DOCUMENT_KIND_LABEL[d.kind] ?? ""}`,
    );
    return words.every((w) => hay.includes(w));
  });
}
