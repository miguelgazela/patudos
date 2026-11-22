import { z } from "zod";

import { DOCUMENT_KINDS } from "./logic";

const isoDate = z
  .string({ error: "Escolhe uma data válida." })
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Escolhe uma data válida.")
  .refine((v) => {
    const [y = 0, m = 1, d = 1] = v.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    return (
      date.getUTCFullYear() === y &&
      date.getUTCMonth() === m - 1 &&
      date.getUTCDate() === d
    );
  }, "Escolhe uma data válida.");

const title = z
  .string({ error: "Escreve um título." })
  .trim()
  .min(1, "Escreve um título.")
  .max(120, "O título é demasiado grande.");

const kind = z.enum(DOCUMENT_KINDS, { error: "Escolhe o tipo." });

export const ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
] as const;

/** Gravação depois do upload direto para `documentos/{pet_id}/…`. */
export const createDocumentSchema = z
  .object({
    petId: z.uuid({ error: "Escolhe o animal." }),
    kind,
    title,
    date: isoDate,
    storagePath: z.string().min(1).max(300),
    mimeType: z.enum(ALLOWED_MIME, { error: "Escolhe uma foto ou um PDF." }),
  })
  .refine(
    (v) =>
      v.storagePath.startsWith(`${v.petId}/`) &&
      !v.storagePath.slice(v.petId.length + 1).includes("/") &&
      !v.storagePath.includes(".."),
    { path: ["storagePath"], message: "Ficheiro inválido." },
  );

export const updateDocumentSchema = z.object({
  id: z.uuid(),
  kind,
  title,
  date: isoDate,
});
