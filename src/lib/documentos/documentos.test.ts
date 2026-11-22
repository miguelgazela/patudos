import { describe, expect, it } from "vitest";

import {
  checkDocumentFile,
  filterDocuments,
  MAX_DOCUMENT_BYTES,
  normalizeText,
  suggestTitle,
  type ListedDocument,
} from "./logic";
import { createDocumentSchema, updateDocumentSchema } from "./schema";

const PET = "11111111-1111-4111-8111-111111111111";

describe("suggestTitle", () => {
  it("usa o tipo e o animal", () => {
    expect(suggestTitle("health_record", "Nina", "female")).toBe(
      "Boletim sanitário da Nina",
    );
    expect(suggestTitle("insurance", "Rex", "male")).toBe("Seguro do Rex");
    expect(suggestTitle("invoice", "Mia")).toBe("Fatura de Mia");
    expect(suggestTitle("other", null)).toBe("Documento");
  });
});

describe("checkDocumentFile", () => {
  it("aceita PDF até 10 MB e recusa acima", () => {
    expect(
      checkDocumentFile({ type: "application/pdf", name: "a.pdf", size: 1000 }),
    ).toEqual({ ok: true, kind: "pdf" });
    const big = checkDocumentFile({
      type: "application/pdf",
      name: "a.pdf",
      size: MAX_DOCUMENT_BYTES + 1,
    });
    expect(big.ok).toBe(false);
    if (!big.ok) expect(big.message).toMatch(/10 MB/);
  });
  it("aceita imagens (incluindo HEIC sem tipo) e recusa o resto", () => {
    expect(
      checkDocumentFile({ type: "image/jpeg", name: "a.jpg", size: 1 }),
    ).toEqual({ ok: true, kind: "image" });
    expect(
      checkDocumentFile({ type: "", name: "IMG_1.HEIC", size: 1 }).ok,
    ).toBe(true);
    expect(
      checkDocumentFile({ type: "text/plain", name: "a.txt", size: 1 }).ok,
    ).toBe(false);
  });
});

const docs: ListedDocument[] = [
  {
    id: "1",
    petId: "a",
    petName: "Nina",
    kind: "invoice",
    title: "Fatura VetLumiar",
    date: "2026-11-21",
  },
  {
    id: "2",
    petId: "a",
    petName: "Nina",
    kind: "insurance",
    title: "Apólice 2026",
    date: "2026-01-01",
  },
  {
    id: "3",
    petId: "b",
    petName: "Rex",
    kind: "health_record",
    title: "Boletim do Rex",
    date: "2022-03-14",
  },
];

describe("filterDocuments", () => {
  it("filtra por tipo", () => {
    expect(filterDocuments(docs, { kind: "invoice" }).map((d) => d.id)).toEqual(
      ["1"],
    );
    expect(filterDocuments(docs, { kind: null })).toHaveLength(3);
  });
  it("pesquisa sem acentos nem maiúsculas, por título ou animal", () => {
    expect(normalizeText("Apólice")).toBe("apolice");
    expect(
      filterDocuments(docs, { query: "apolice" }).map((d) => d.id),
    ).toEqual(["2"]);
    expect(filterDocuments(docs, { query: "REX" }).map((d) => d.id)).toEqual([
      "3",
    ]);
    expect(
      filterDocuments(docs, { query: "nina fatura" }).map((d) => d.id),
    ).toEqual(["1"]);
    expect(filterDocuments(docs, { query: "nada" })).toHaveLength(0);
  });
  it("combina tipo e pesquisa", () => {
    expect(
      filterDocuments(docs, { kind: "insurance", query: "fatura" }),
    ).toHaveLength(0);
  });
});

describe("schemas", () => {
  const base = {
    petId: PET,
    kind: "insurance",
    title: "  Seguro 2026 ",
    date: "2026-01-01",
    storagePath: `${PET}/abc.pdf`,
    mimeType: "application/pdf",
  };
  it("aceita e apara o título", () => {
    const r = createDocumentSchema.safeParse(base);
    expect(r.success && r.data.title).toBe("Seguro 2026");
  });
  it("recusa tipo, data e caminho inválidos", () => {
    expect(createDocumentSchema.safeParse({ ...base, kind: "x" }).success).toBe(
      false,
    );
    expect(
      createDocumentSchema.safeParse({ ...base, date: "2026-02-31" }).success,
    ).toBe(false);
    expect(
      createDocumentSchema.safeParse({ ...base, title: "  " }).success,
    ).toBe(false);
    expect(
      createDocumentSchema.safeParse({ ...base, storagePath: "outro/abc.pdf" })
        .success,
    ).toBe(false);
    expect(
      createDocumentSchema.safeParse({
        ...base,
        storagePath: `${PET}/../x.pdf`,
      }).success,
    ).toBe(false);
    expect(
      createDocumentSchema.safeParse({ ...base, mimeType: "text/html" })
        .success,
    ).toBe(false);
  });
  it("valida a edição", () => {
    expect(
      updateDocumentSchema.safeParse({
        id: PET,
        kind: "other",
        title: "x",
        date: "2026-01-01",
      }).success,
    ).toBe(true);
  });
});
