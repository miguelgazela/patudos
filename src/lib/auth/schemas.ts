import { z } from "zod";

export const emailSchema = z
  .string({ error: "Escreve o teu email." })
  .trim()
  .toLowerCase()
  .min(1, "Escreve o teu email.")
  .pipe(z.email("Escreve um email válido, por exemplo ana@exemplo.pt"));

export const codeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "O código tem 6 números.");

export const nameSchema = z
  .string({ error: "Escreve o teu nome." })
  .trim()
  .min(1, "Escreve o teu nome.")
  .max(60, "O nome é demasiado grande. Usa até 60 letras.");
