import { z } from "zod";

import { approxBirthDate, lisbonToday } from "./age";
import { PET_COLORS, SPECIES } from "./constants";

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((v) => (v === "" ? null : v));

export const petSchema = z
  .object({
    name: z
      .string({ error: "Escreve o nome." })
      .trim()
      .min(1, "Escreve o nome.")
      .max(40, "O nome é demasiado grande. Usa até 40 letras."),
    species: z.enum(SPECIES, { error: "Escolhe se é cão ou gato." }),
    birth_mode: z.enum(["exact", "approx", "none"]).default("none"),
    birth_date: z.string().trim().default(""),
    approx_value: z.string().trim().default(""),
    approx_unit: z.enum(["months", "years"]).default("years"),
    breed: optionalText(60, "A raça é demasiado grande."),
    sex: z
      .enum(["female", "male", ""])
      .default("")
      .transform((v) => (v === "" ? null : v)),
    neutered: z
      .enum(["yes", "no", ""])
      .default("")
      .transform((v) => (v === "" ? null : v === "yes")),
    microchip: optionalText(30, "O número do chip é demasiado grande."),
    color: z.enum(PET_COLORS, { error: "Escolhe uma cor." }),
    notes: optionalText(
      500,
      "As notas são grandes demais. Usa até 500 letras.",
    ),
  })
  .transform((v, ctx) => {
    let birth_date: string | null = null;
    let estimate = false;

    if (v.birth_mode === "exact" && v.birth_date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v.birth_date)) {
        ctx.addIssue({
          code: "custom",
          path: ["birth_date"],
          message: "Escolhe uma data válida.",
        });
      } else if (v.birth_date > lisbonToday()) {
        ctx.addIssue({
          code: "custom",
          path: ["birth_date"],
          message: "A data não pode ser no futuro.",
        });
      } else {
        birth_date = v.birth_date;
      }
    } else if (v.birth_mode === "approx" && v.approx_value !== "") {
      const n = Number(v.approx_value);
      const max = v.approx_unit === "years" ? 40 : 480;
      if (!Number.isInteger(n) || n < 0 || n > max) {
        ctx.addIssue({
          code: "custom",
          path: ["approx_value"],
          message: "Escreve um número, por exemplo 3.",
        });
      } else {
        birth_date = approxBirthDate(n, v.approx_unit);
        estimate = true;
      }
    }

    return {
      name: v.name,
      species: v.species,
      breed: v.breed,
      sex: v.sex,
      neutered: v.neutered,
      microchip: v.microchip,
      color: v.color,
      notes: v.notes,
      birth_date,
      birth_date_is_estimate: estimate,
    };
  });

export type PetInput = z.infer<typeof petSchema>;

export const PHOTO_MAX_BYTES = 1_500_000;
