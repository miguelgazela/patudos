import { z } from "zod";

export const inviteSchema = z.object({
  email: z
    .string({ error: "Escreve o email da pessoa." })
    .trim()
    .toLowerCase()
    .min(1, "Escreve o email da pessoa.")
    .pipe(z.email("Escreve um email válido, por exemplo ana@exemplo.pt")),
  role: z.enum(["caregiver", "owner"]).default("caregiver"),
});

export const roleSchema = z.enum(["caregiver", "owner"]);
