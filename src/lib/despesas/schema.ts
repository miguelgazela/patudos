import { z } from "zod";

import { EXPENSE_CATEGORIES } from "@/lib/vet-visits/schema";

const uuid = (message: string) => z.uuid({ error: message });

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

const cents = (min: number) =>
  z
    .number({ error: "Escreve o valor." })
    .int("O valor tem de estar em cêntimos.")
    .min(min, min > 0 ? "Escreve o valor." : "O valor não pode ser negativo.")
    .max(100_000_000, "O valor é demasiado alto.");

/** Payload da RPC `save_expense` (ver supabase/migrations/*_despesas_registo_e_resumo.sql). */
export const expenseInputSchema = z
  .object({
    id: uuid("Despesa inválida.").optional(),
    amount_cents: cents(1),
    category: z.enum(EXPENSE_CATEGORIES, { error: "Escolhe a categoria." }),
    spent_on: isoDate.optional(),
    description: z
      .string()
      .trim()
      .max(120, "A descrição é demasiado grande.")
      .optional()
      .transform((v) => (v ? v : undefined)),
    paid_by: uuid("Quem pagou é inválido.").optional(),
    document_id: uuid("Documento inválido.").optional(),
    /** Na edição pode faltar: só mudam os campos (o total e os animais ficam). */
    splits: z
      .array(
        z.object({
          pet_id: uuid("Escolhe o animal."),
          amount_cents: cents(0),
        }),
      )
      .min(1, "Escolhe pelo menos um animal.")
      .optional(),
  })
  .superRefine((v, ctx) => {
    if (!v.id && !v.splits) {
      ctx.addIssue({
        code: "custom",
        path: ["splits"],
        message: "Escolhe pelo menos um animal.",
      });
    }
    if (
      v.splits &&
      new Set(v.splits.map((s) => s.pet_id)).size !== v.splits.length
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["splits"],
        message: "Cada animal só pode aparecer uma vez.",
      });
    }
  });

export type ExpenseInput = z.infer<typeof expenseInputSchema>;
