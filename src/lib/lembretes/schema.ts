import { z } from "zod";

import { REPEAT_OPTIONS } from "./recurrence";

export const CHANNELS = ["push", "email", "calendar"] as const;
export type Channel = (typeof CHANNELS)[number];

export const CHANNEL_LABEL: Record<Channel, string> = {
  push: "Notificação",
  email: "Email",
  calendar: "Calendário",
};

const isoDate = z
  .string({ error: "Escolhe o dia." })
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Escolhe o dia.");

/** Ecrã 23: lembrete manual (data e hora locais, em Europe/Lisbon). */
export const reminderSchema = z.object({
  id: z.uuid().optional(),
  pet_id: z.uuid({ error: "Escolhe o animal." }),
  title: z
    .string({ error: "Escreve o que é preciso lembrar." })
    .trim()
    .min(1, "Escreve o que é preciso lembrar.")
    .max(80, "O texto é demasiado grande."),
  on: isoDate,
  at: z
    .string({ error: "Escolhe a hora." })
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Escolhe a hora."),
  repeat: z.object({
    kind: z.enum(
      REPEAT_OPTIONS.map((o) => o.kind) as [
        (typeof REPEAT_OPTIONS)[number]["kind"],
      ],
    ),
    every: z.number().int().min(2, "Escolhe pelo menos 2 meses.").max(60),
  }),
  channels: z.array(z.enum(CHANNELS)).max(3),
});
export type ReminderInput = z.input<typeof reminderSchema>;

export const SUGGESTIONS = [
  "Comprar ração",
  "Banho",
  "Cortar unhas",
  "Escovar dentes",
];

/** Confirmação rápida do «Feito» de um tratamento (E05-Feito). */
export const completeTreatmentSchema = z.object({
  occurrenceId: z.uuid(),
  on: isoDate,
  product: z
    .string()
    .trim()
    .max(80, "O produto é demasiado grande.")
    .optional(),
  nextDueOn: isoDate.optional(),
  remind: z.boolean(),
});
export type CompleteTreatmentInput = z.input<typeof completeTreatmentSchema>;
