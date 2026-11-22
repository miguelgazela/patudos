import "server-only";

import { notFound } from "next/navigation";

import { getCurrentProfile } from "@/lib/auth/current-profile";
import { lisbonDate, todayISO } from "@/lib/dates";
import { daysBetween } from "@/lib/ficha/due";
import { listPets, type PetCard } from "@/lib/pets/data";
import { createClient } from "@/lib/supabase/server";
import { addMonthsISO } from "@/lib/vet-visits/next-due";

import { groupHoje, type HojeGroups, type OccurrenceRow } from "./hoje";
import { describeRecurrence, parseRepeat, type Repeat } from "./recurrence";
import type { Channel } from "./schema";

type Client = Awaited<ReturnType<typeof createClient>>;

/** O que a confirmação do «Feito» precisa de saber do tratamento. */
export type TreatmentInfo = {
  title: string;
  type: string;
  product: string | null;
  /** Data que a confirmação propõe para a próxima dose. */
  suggestedNext: string;
  intervalMonths: number;
};

function monthsBetween(fromIso: string, toIso: string): number {
  return Math.max(1, Math.round(daysBetween(fromIso, toIso) / 30.4));
}

/** Eventos de saúde (e intervalos) para a confirmação rápida, por id do evento. */
async function treatmentInfos(
  supabase: Client,
  eventIds: string[],
  today: string,
): Promise<Map<string, TreatmentInfo>> {
  const out = new Map<string, TreatmentInfo>();
  if (!eventIds.length) return out;
  const { data: events } = await supabase
    .from("health_events")
    .select("id, type, title, product, preset_id, occurred_on, next_due_on")
    .in("id", eventIds);
  const presetIds = [
    ...new Set((events ?? []).map((e) => e.preset_id).filter(Boolean)),
  ] as string[];
  const { data: presets } = presetIds.length
    ? await supabase
        .from("care_presets")
        .select("id, interval_months")
        .in("id", presetIds)
    : { data: [] };
  const interval = new Map(
    (presets ?? []).map((p) => [p.id, p.interval_months]),
  );
  for (const e of events ?? []) {
    const months =
      (e.preset_id ? interval.get(e.preset_id) : undefined) ??
      (e.next_due_on ? monthsBetween(e.occurred_on, e.next_due_on) : 12);
    out.set(e.id, {
      title: e.title,
      type: e.type,
      product: e.product,
      intervalMonths: months,
      suggestedNext: addMonthsISO(today, months),
    });
  }
  return out;
}

export type HojeData = {
  meId: string;
  name: string;
  pets: Record<string, PetCard>;
  hasPets: boolean;
  groups: HojeGroups;
  /** Tratamento por id da ocorrência (só lembretes de saúde). */
  treatments: Record<string, TreatmentInfo>;
  /** Nome de quem marcou «Feito» («ti» para o próprio). */
  names: Record<string, string>;
  /** Algum dispositivo do utilizador já recebe notificações. */
  hasPush: boolean;
};

export async function getHoje(): Promise<HojeData> {
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const now = new Date();
  const today = todayISO(now);

  const pets = await listPets(profile.id, false);
  const base = {
    meId: profile.id,
    name: profile.name ?? "",
    pets: Object.fromEntries(pets.map((p) => [p.id, p])),
    hasPets: pets.length > 0,
  };
  const empty: HojeGroups = {
    overdue: [],
    today: [],
    upcoming: [],
    recentlyDone: [],
  };
  if (!pets.length)
    return { ...base, groups: empty, treatments: {}, names: {}, hasPush: true };

  // Garante as ocorrências recorrentes (o cron do passo 2 faz o mesmo para todos).
  await supabase.rpc("refresh_my_occurrences");

  const since = new Date(now.getTime() - 3 * 3_600_000).toISOString();
  const until = new Date(now.getTime() + 32 * 86_400_000).toISOString();
  const { data } = await supabase
    .from("reminder_occurrences")
    .select(
      "id, reminder_id, pet_id, scheduled_for, done_at, done_by, reminders!inner(title, rrule, source_type, source_id, active, ended_at)",
    )
    .or(`done_at.is.null,done_at.gte.${since}`)
    .lte("scheduled_for", until)
    .order("scheduled_for");

  const petIds = new Set(pets.map((p) => p.id));
  const rows: OccurrenceRow[] = (data ?? [])
    .filter((o) => petIds.has(o.pet_id))
    .map((o) => ({
      id: o.id,
      reminderId: o.reminder_id,
      petId: o.pet_id,
      title: o.reminders.title,
      scheduledFor: o.scheduled_for,
      rrule: o.reminders.rrule,
      sourceType:
        o.reminders.source_type === "health_event" ||
        o.reminders.source_type === "medication"
          ? o.reminders.source_type
          : null,
      sourceId: o.reminders.source_id,
      live: o.reminders.active && !o.reminders.ended_at,
      doneAt: o.done_at,
      doneBy: o.done_by,
    }));

  const groups = groupHoje(rows, now);
  const shown = [
    ...groups.overdue,
    ...groups.today,
    ...groups.upcoming,
    ...groups.recentlyDone,
  ];

  const eventIds = [
    ...new Set(
      shown
        .filter((e) => e.kind === "treatment" && e.sourceId)
        .map((e) => e.sourceId as string),
    ),
  ];
  const infos = await treatmentInfos(supabase, eventIds, today);
  const treatments: Record<string, TreatmentInfo> = {};
  for (const e of shown) {
    const info = e.sourceId ? infos.get(e.sourceId) : undefined;
    if (info) treatments[e.id] = info;
  }

  const doneBy = [
    ...new Set(
      groups.recentlyDone.map((e) => e.doneBy).filter((x): x is string => !!x),
    ),
  ];
  const names: Record<string, string> = {};
  if (doneBy.length) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name")
      .in("id", doneBy);
    for (const p of profiles ?? []) {
      names[p.id] =
        p.id === profile.id ? "ti" : p.name?.trim() || "outra pessoa";
    }
  }
  const { count: pushCount } = await supabase
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true });
  return { ...base, groups, treatments, names, hasPush: (pushCount ?? 0) > 0 };
}

/** Datas previstas do animal que têm ocorrência por fazer (para o «Feito» da ficha). */
export async function getOpenTreatmentOccurrences(
  petId: string,
): Promise<Record<string, { occurrenceId: string; info: TreatmentInfo }>> {
  const supabase = await createClient();
  const today = todayISO();
  const { data } = await supabase
    .from("reminder_occurrences")
    .select("id, reminders!inner(source_type, source_id, active, ended_at)")
    .eq("pet_id", petId)
    .is("done_at", null)
    .eq("reminders.source_type", "health_event")
    .eq("reminders.active", true)
    .is("reminders.ended_at", null);
  const rows = (data ?? []).filter((o) => o.reminders.source_id);
  const infos = await treatmentInfos(
    supabase,
    rows.map((o) => o.reminders.source_id as string),
    today,
  );
  const out: Record<string, { occurrenceId: string; info: TreatmentInfo }> = {};
  for (const o of rows) {
    const eventId = o.reminders.source_id as string;
    const info = infos.get(eventId);
    if (info) out[eventId] = { occurrenceId: o.id, info };
  }
  return out;
}

export type ReminderRow = {
  id: string;
  title: string;
  /** «21/12 · todos os meses · da vacina de 21/11». */
  detail: string;
  paused: boolean;
  /** Lembretes de saúde seguem o registo: só se pausam ou apagam. */
  auto: boolean;
  canEdit: boolean;
  form: {
    on: string;
    at: string;
    repeat: Repeat;
    channels: Channel[];
  };
};

export type EndedRow = { id: string; title: string; detail: string };

export type PetRemindersData = {
  petId: string;
  petName: string;
  notify: boolean;
  active: ReminderRow[];
  ended: EndedRow[];
};

const ORIGIN: Record<string, string> = {
  vaccine: "da vacina",
  deworming_internal: "da desparasitação",
  deworming_external: "da desparasitação",
};

function shortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}
function fullDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** Ecrã 22. 404 se não houver acesso ao animal. */
export async function getPetReminders(
  petId: string,
): Promise<PetRemindersData> {
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const today = todayISO();

  const { data: pet } = await supabase
    .from("pets")
    .select("id, name, pet_members(user_id, role, notify)")
    .eq("id", petId)
    .maybeSingle();
  if (!pet) notFound();
  const me = pet.pet_members.find((m) => m.user_id === profile.id);
  const isOwner = me?.role === "owner";

  await supabase.rpc("refresh_my_occurrences");

  const [reminders, occurrences] = await Promise.all([
    supabase
      .from("reminders")
      .select(
        "id, title, due_at, rrule, ends_on, channels, source_type, source_id, active, ended_at, created_by",
      )
      .eq("pet_id", petId)
      .order("due_at"),
    supabase
      .from("reminder_occurrences")
      .select("reminder_id, scheduled_for, done_at")
      .eq("pet_id", petId),
  ]);

  const eventIds = (reminders.data ?? [])
    .filter((r) => r.source_type === "health_event" && r.source_id)
    .map((r) => r.source_id as string);
  const { data: events } = eventIds.length
    ? await supabase
        .from("health_events")
        .select("id, type, occurred_on")
        .in("id", eventIds)
    : { data: [] };
  const eventById = new Map((events ?? []).map((e) => [e.id, e]));

  const occByReminder = new Map<
    string,
    { scheduled_for: string; done_at: string | null }[]
  >();
  for (const o of occurrences.data ?? []) {
    const list = occByReminder.get(o.reminder_id) ?? [];
    list.push(o);
    occByReminder.set(o.reminder_id, list);
  }

  const active: ReminderRow[] = [];
  const ended: (EndedRow & { sort: string })[] = [];

  for (const r of reminders.data ?? []) {
    const occ = occByReminder.get(r.id) ?? [];
    const dueDate = lisbonDate(r.due_at);
    const oneOffDone =
      !r.rrule && occ.length > 0 && occ.every((o) => o.done_at);
    const endsPast = !!r.ends_on && r.ends_on < today;
    const endedOn = r.ended_at
      ? lisbonDate(r.ended_at)
      : endsPast
        ? (r.ends_on as string)
        : oneOffDone
          ? lisbonDate(
              occ
                .map((o) => o.done_at as string)
                .sort()
                .at(-1) as string,
            )
          : null;

    if (endedOn) {
      ended.push({
        id: r.id,
        title: r.title,
        detail: `${oneOffDone && !r.ended_at ? "Feito a" : "Terminou a"} ${fullDate(endedOn)}`,
        sort: endedOn,
      });
      continue;
    }

    const upcoming = occ
      .filter((o) => !o.done_at && lisbonDate(o.scheduled_for) >= today)
      .map((o) => o.scheduled_for)
      .sort()[0];
    const next = upcoming ?? r.due_at;
    const nextDate = lisbonDate(next);
    const ev =
      r.source_type === "health_event" && r.source_id
        ? eventById.get(r.source_id)
        : undefined;
    const origin = ev
      ? `${ORIGIN[ev.type] ?? "do registo"} de ${shortDate(ev.occurred_on)}`
      : r.source_type === "medication"
        ? "da medicação"
        : null;
    const recurrence = describeRecurrence(r.rrule);
    const detail = [
      r.source_type === "medication" ? null : shortDate(nextDate),
      recurrence,
      origin,
      !r.active ? "pausado" : null,
    ]
      .filter(Boolean)
      .join(" · ");

    const time = new Intl.DateTimeFormat("pt-PT", {
      timeZone: "Europe/Lisbon",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(r.due_at));
    active.push({
      id: r.id,
      title: r.title,
      detail,
      paused: !r.active,
      auto: !!r.source_type,
      canEdit: isOwner || r.created_by === profile.id,
      form: {
        on: dueDate,
        at: time,
        repeat: parseRepeat(r.rrule),
        channels: r.channels.filter((c): c is Channel =>
          ["push", "email", "calendar"].includes(c),
        ),
      },
    });
  }

  ended.sort((a, b) => b.sort.localeCompare(a.sort));
  return {
    petId: pet.id,
    petName: pet.name,
    notify: me?.notify ?? true,
    active,
    ended: ended
      .slice(0, 10)
      .map((e) => ({ id: e.id, title: e.title, detail: e.detail })),
  };
}
