import { describeRRule } from "@/lib/vet-visits/schedule";

export type RepeatKind =
  "never" | "daily" | "weekly" | "monthly" | "everyMonths" | "yearly";

export type Repeat = { kind: RepeatKind; every: number };

export const REPEAT_OPTIONS: { kind: RepeatKind; label: string }[] = [
  { kind: "never", label: "Nunca" },
  { kind: "daily", label: "Todos os dias" },
  { kind: "weekly", label: "Todas as semanas" },
  { kind: "monthly", label: "Todos os meses" },
  { kind: "everyMonths", label: "De X em X meses" },
  { kind: "yearly", label: "Todos os anos" },
];

/**
 * RRULE (subconjunto que o SQL `expand_rrule` percebe) da repetição escolhida.
 * A hora vem de `due_at`, por isso não leva BYHOUR.
 */
export function buildRRule(r: Repeat): string | null {
  const n = Math.max(2, Math.floor(r.every || 2));
  switch (r.kind) {
    case "never":
      return null;
    case "daily":
      return "FREQ=DAILY";
    case "weekly":
      return "FREQ=WEEKLY";
    case "monthly":
      return "FREQ=MONTHLY";
    case "everyMonths":
      return `FREQ=MONTHLY;INTERVAL=${n}`;
    case "yearly":
      return "FREQ=YEARLY";
  }
}

function parts(rrule: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of rrule.replace(/^RRULE:/i, "").split(";")) {
    const [k, v] = p.split("=");
    if (k && v) out[k.toUpperCase()] = v.toUpperCase();
  }
  return out;
}

/** Inverso de `buildRRule`, para editar. Regras desconhecidas contam como «Nunca». */
export function parseRepeat(rrule: string | null | undefined): Repeat {
  if (!rrule) return { kind: "never", every: 2 };
  const p = parts(rrule);
  const interval = Math.max(1, Number(p.INTERVAL ?? 1) || 1);
  if (p.FREQ === "DAILY" && interval === 1 && !p.BYHOUR)
    return { kind: "daily", every: 2 };
  if (p.FREQ === "WEEKLY" && interval === 1)
    return { kind: "weekly", every: 2 };
  if (p.FREQ === "MONTHLY")
    return interval === 1
      ? { kind: "monthly", every: 2 }
      : { kind: "everyMonths", every: interval };
  if (p.FREQ === "YEARLY" && interval === 1)
    return { kind: "yearly", every: 2 };
  return { kind: "never", every: 2 };
}

/** «Todos os meses», «De 3 em 3 meses», «Todos os dias às 08:00»… */
export function describeRecurrence(rrule: string | null | undefined): string {
  if (!rrule) return "";
  const p = parts(rrule);
  const n = Math.max(1, Number(p.INTERVAL ?? 1) || 1);
  if (p.FREQ === "DAILY" && p.BYHOUR) return describeRRule(rrule);
  switch (p.FREQ) {
    case "DAILY":
      return n === 1 ? "Todos os dias" : `De ${n} em ${n} dias`;
    case "WEEKLY":
      return n === 1 ? "Todas as semanas" : `De ${n} em ${n} semanas`;
    case "MONTHLY":
      return n === 1 ? "Todos os meses" : `De ${n} em ${n} meses`;
    case "YEARLY":
      return n === 1 ? "Todos os anos" : `De ${n} em ${n} anos`;
    default:
      return "";
  }
}
