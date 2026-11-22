import { z } from "zod";

/**
 * Payloads das funções Postgres `record_vet_visit`, `record_weight` e
 * `record_home_treatment` (ver supabase/migrations/*_registar_consulta.sql).
 * Os nomes dos campos são os do JSON que a função recebe.
 */

export const HEALTH_EVENT_TYPES = [
  "vaccine",
  "deworming_internal",
  "deworming_external",
  "surgery",
  "lab_test",
  "other",
] as const;
export type HealthEventType = (typeof HEALTH_EVENT_TYPES)[number];

export const EXPENSE_CATEGORIES = [
  "veterinary",
  "medication",
  "food",
  "hygiene",
  "accessories",
  "insurance",
  "boarding",
  "other",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

const isoDate = (message = "Escolhe uma data válida.") =>
  z
    .string({ error: message })
    .regex(/^\d{4}-\d{2}-\d{2}$/, message)
    .refine((v) => {
      const [y = 0, m = 1, d = 1] = v.split("-").map(Number);
      const date = new Date(Date.UTC(y, m - 1, d));
      return (
        date.getUTCFullYear() === y &&
        date.getUTCMonth() === m - 1 &&
        date.getUTCDate() === d
      );
    }, message);

/** Texto opcional: vazio vira `undefined` e não vai no payload. */
const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .optional()
    .transform((v) => (v ? v : undefined));

const uuid = (message: string) => z.uuid({ error: message });

export const weightKgSchema = z
  .number({ error: "Escreve o peso em kg." })
  .gt(0, "O peso tem de ser maior que zero.")
  .lt(1000, "O peso parece demasiado alto.")
  .multipleOf(0.01, "Usa no máximo duas casas decimais.");

const amountCentsSchema = z
  .number({ error: "Escreve o valor." })
  .int("O valor tem de estar em cêntimos.")
  .min(0, "O valor não pode ser negativo.")
  .max(100_000_000, "O valor é demasiado alto.");

export const healthEventSchema = z
  .object({
    type: z.enum(HEALTH_EVENT_TYPES, { error: "Escolhe o tipo." }),
    title: z
      .string({ error: "Escreve o nome." })
      .trim()
      .min(1, "Escreve o nome.")
      .max(80, "O nome é demasiado grande."),
    occurred_on: isoDate().optional(),
    product: optionalText(80, "O produto é demasiado grande."),
    preset_id: uuid("Preset inválido.").optional(),
    notes: optionalText(500, "A nota é demasiado grande."),
    next_due_on: isoDate().optional(),
    remind: z.boolean().default(true),
  })
  .refine(
    (v) => !v.next_due_on || !v.occurred_on || v.next_due_on >= v.occurred_on,
    {
      path: ["next_due_on"],
      message: "A próxima data não pode ser anterior à data do registo.",
    },
  );

export const medicationSchema = z
  .object({
    name: z
      .string({ error: "Escreve o nome do medicamento." })
      .trim()
      .min(1, "Escreve o nome do medicamento.")
      .max(80, "O nome é demasiado grande."),
    dose: optionalText(60, "A dose é demasiado grande."),
    schedule_rrule: optionalText(200, "A frequência é inválida."),
    starts_on: isoDate().optional(),
    ends_on: isoDate().optional(),
    notes: optionalText(500, "A nota é demasiado grande."),
    remind: z.boolean().default(true),
  })
  .refine((v) => !v.ends_on || !v.starts_on || v.ends_on >= v.starts_on, {
    path: ["ends_on"],
    message: "O fim não pode ser antes do início.",
  });

export const expenseSchema = z.object({
  amount_cents: amountCentsSchema,
  category: z.enum(EXPENSE_CATEGORIES, { error: "Escolhe a categoria." }),
  description: optionalText(120, "A descrição é demasiado grande."),
  /** «Pago por»; se faltar, é quem regista. */
  paid_by: uuid("Pagador inválido.").optional(),
});

export const vetVisitSchema = z.object({
  pet_id: uuid("Escolhe o animal."),
  visited_on: isoDate().optional(),
  reason: z
    .string({ error: "Escreve o motivo." })
    .trim()
    .min(1, "Escreve o motivo.")
    .max(120, "O motivo é demasiado grande."),
  vet_name: optionalText(80, "O nome é demasiado grande."),
  clinic: optionalText(80, "O nome da clínica é demasiado grande."),
  notes: optionalText(2000, "As notas são demasiado grandes."),
  weight_kg: weightKgSchema.optional(),
  health_events: z.array(healthEventSchema).max(20).default([]),
  medications: z.array(medicationSchema).max(20).default([]),
  expense: expenseSchema.optional(),
  /** Documento já carregado (carregado pelo próprio utilizador) para ligar à consulta. */
  document_id: uuid("Documento inválido.").optional(),
});
export type VetVisitInput = z.input<typeof vetVisitSchema>;
export type VetVisitPayload = z.output<typeof vetVisitSchema>;

export const quickWeightSchema = z.object({
  pet_id: uuid("Escolhe o animal."),
  measured_on: isoDate().optional(),
  weight_kg: weightKgSchema,
});
export type QuickWeightPayload = z.output<typeof quickWeightSchema>;

export const homeTreatmentSchema = z
  .object({
    pet_id: uuid("Escolhe o animal."),
    type: z.enum(["vaccine", "deworming_internal", "deworming_external"], {
      error: "Escolhe o tipo.",
    }),
    title: z
      .string({ error: "Escreve o nome." })
      .trim()
      .min(1, "Escreve o nome.")
      .max(80, "O nome é demasiado grande."),
    occurred_on: isoDate().optional(),
    product: optionalText(80, "O produto é demasiado grande."),
    preset_id: uuid("Preset inválido.").optional(),
    notes: optionalText(500, "A nota é demasiado grande."),
    next_due_on: isoDate().optional(),
    remind: z.boolean().default(true),
    expense: expenseSchema.partial({ category: true }).optional(),
  })
  .refine(
    (v) => !v.next_due_on || !v.occurred_on || v.next_due_on >= v.occurred_on,
    {
      path: ["next_due_on"],
      message: "A próxima data não pode ser anterior à data do registo.",
    },
  );
export type HomeTreatmentPayload = z.output<typeof homeTreatmentSchema>;
