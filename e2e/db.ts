// Leitura direta da BD local (chave service_role de demonstração do Supabase local).
const API = process.env.SUPABASE_LOCAL_URL ?? "http://127.0.0.1:55321";
const SERVICE_ROLE =
  process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const headers = {
  apikey: SERVICE_ROLE,
  Authorization: `Bearer ${SERVICE_ROLE}`,
};

export async function rows<T = Record<string, unknown>>(
  table: string,
  query: string,
): Promise<T[]> {
  const res = await fetch(`${API}/rest/v1/${table}?${query}`, { headers });
  if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`);
  return (await res.json()) as T[];
}

/** Existe o ficheiro no bucket? */
export async function storageObjectExists(
  bucket: string,
  path: string,
): Promise<boolean> {
  const res = await fetch(`${API}/storage/v1/object/info/${bucket}/${path}`, {
    headers,
  });
  return res.ok;
}

/** Insere uma linha (service_role, ignora a RLS): para montar cenários como «cuidador do animal». */
export async function insertRow(
  table: string,
  body: Record<string, unknown>,
): Promise<void> {
  const res = await fetch(`${API}/rest/v1/${table}`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`);
}
