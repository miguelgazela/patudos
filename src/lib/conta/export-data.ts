import "server-only";

import { createClient } from "@/lib/supabase/server";

import { buildExport, zipFileName, type ExportRaw } from "./export-model";

type Client = Awaited<ReturnType<typeof createClient>>;

export type ExportManifest = {
  fileName: string;
  json: unknown;
  csvs: { zipPath: string; content: string }[];
  readme: string;
  /** `url` a null: o ficheiro já não existe no Storage (o cliente regista-o como em falta). */
  files: { zipPath: string; url: string | null }[];
};

/** Validade dos links dos ficheiros: o tempo de sobra para descarregar tudo. */
const SIGNED_URL_SECONDS = 30 * 60;
const PAGE = 1000; // o PostgREST devolve no máximo 1000 linhas por pedido
const SIGN_CHUNK = 100;

async function all<T>(
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if ((data?.length ?? 0) < PAGE) return out;
  }
}

async function signAll(
  supabase: Client,
  bucket: "fotos" | "documentos",
  paths: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (let i = 0; i < paths.length; i += SIGN_CHUNK) {
    const { data } = await supabase.storage
      .from(bucket)
      .createSignedUrls(paths.slice(i, i + SIGN_CHUNK), SIGNED_URL_SECONDS);
    for (const item of data ?? []) {
      if (item.path && item.signedUrl) map.set(item.path, item.signedUrl);
    }
  }
  return map;
}

/**
 * Tudo o que o utilizador pode ver, lido com a SESSÃO DELE (RLS aplica-se; nunca service role).
 * Devolve só texto + links assinados de curta duração: o ZIP é montado no cliente, porque as
 * funções da Vercel limitam o corpo da resposta a ~4,5 MB e os documentos passam disso.
 * Devolve `null` sem sessão.
 */
export async function getExportManifest(): Promise<ExportManifest | null> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return null;
  const meId = claims.claims.sub;

  const { data: me } = await supabase
    .from("profiles")
    .select("id, name, email, created_at, reminder_emails")
    .eq("id", meId)
    .single();
  if (!me) return null;

  // Os animais a que tenho acesso agora (a RLS de `pets` também mostra os que criei e deixei).
  const members = await all((f, t) =>
    supabase
      .from("pet_members")
      .select("pet_id, user_id, role, notify")
      .order("pet_id")
      .order("user_id")
      .range(f, t),
  );
  const petIds = new Set(
    members.filter((m) => m.user_id === meId).map((m) => m.pet_id),
  );
  const mine = <T extends { pet_id: string }>(rows: T[]) =>
    rows.filter((r) => petIds.has(r.pet_id));

  const [
    pets,
    profiles,
    visits,
    weights,
    events,
    medications,
    reminders,
    occurrences,
    expenses,
    splits,
    documents,
    clinics,
    memories,
  ] = await Promise.all([
    all((f, t) =>
      supabase
        .from("pets")
        .select("*")
        .order("created_at")
        .order("id")
        .range(f, t),
    ),
    all((f, t) =>
      supabase.from("profiles").select("id, name").order("id").range(f, t),
    ),
    all((f, t) =>
      supabase.from("vet_visits").select("*").order("id").range(f, t),
    ),
    all((f, t) => supabase.from("weights").select("*").order("id").range(f, t)),
    all((f, t) =>
      supabase.from("health_events").select("*").order("id").range(f, t),
    ),
    all((f, t) =>
      supabase.from("medications").select("*").order("id").range(f, t),
    ),
    all((f, t) =>
      supabase.from("reminders").select("*").order("id").range(f, t),
    ),
    all((f, t) =>
      supabase.from("reminder_occurrences").select("*").order("id").range(f, t),
    ),
    all((f, t) =>
      supabase.from("expenses").select("*").order("id").range(f, t),
    ),
    all((f, t) =>
      supabase
        .from("expense_splits")
        .select("*")
        .order("expense_id")
        .order("pet_id")
        .range(f, t),
    ),
    all((f, t) =>
      supabase.from("documents").select("*").order("id").range(f, t),
    ),
    all((f, t) => supabase.from("clinics").select("*").order("id").range(f, t)),
    all((f, t) =>
      supabase.from("pet_memories").select("*").order("id").range(f, t),
    ),
  ]);

  const names: Record<string, string> = {};
  for (const p of profiles) if (p.name?.trim()) names[p.id] = p.name.trim();

  // As clínicas visíveis incluem as que criei sem uso; só vão as dos meus animais/consultas.
  const usedClinics = new Set(
    [...pets.filter((p) => petIds.has(p.id)), ...mine(visits)].flatMap((r) =>
      r.clinic_id ? [r.clinic_id] : [],
    ),
  );

  const raw: ExportRaw = {
    exportedAt: new Date().toISOString(),
    me,
    pets: pets.filter((p) => petIds.has(p.id)),
    members: mine(members),
    names,
    clinics: clinics.filter((c) => usedClinics.has(c.id)),
    visits: mine(visits),
    weights: mine(weights),
    events: mine(events),
    medications: mine(medications),
    reminders: mine(reminders),
    occurrences: mine(occurrences),
    expenses,
    // Só as partes dos animais a que tenho acesso (a despesa pode ter mais animais).
    splits: mine(splits),
    documents: mine(documents),
    memories: mine(memories),
  };

  const bundle = buildExport(raw);
  const [photoUrls, docUrls] = await Promise.all([
    signAll(
      supabase,
      "fotos",
      bundle.files
        .filter((f) => f.bucket === "fotos")
        .map((f) => f.storagePath),
    ),
    signAll(
      supabase,
      "documentos",
      bundle.files
        .filter((f) => f.bucket === "documentos")
        .map((f) => f.storagePath),
    ),
  ]);

  return {
    fileName: zipFileName(),
    json: bundle.json,
    csvs: bundle.csvs,
    readme: bundle.readme,
    files: bundle.files.map((f) => ({
      zipPath: f.zipPath,
      url:
        (f.bucket === "fotos" ? photoUrls : docUrls).get(f.storagePath) ?? null,
    })),
  };
}
