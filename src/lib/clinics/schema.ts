import { z } from "zod";

const optional = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .optional()
    .transform((v) => (v ? v : null));

export const clinicDetailsSchema = z.object({
  name: z
    .string({ error: "Escreve o nome da clínica." })
    .trim()
    .min(1, "Escreve o nome da clínica.")
    .max(80, "O nome é demasiado grande."),
  phone: optional(30, "O telefone é demasiado grande."),
  address: optional(200, "A morada é demasiado grande."),
});
export type ClinicDetailsInput = z.input<typeof clinicDetailsSchema>;
