import { getExportManifest } from "@/lib/conta/export-data";
import { limitMessages } from "@/lib/limites";
import { createClient } from "@/lib/supabase/server";

/**
 * Exportar os meus dados: devolve o JSON, os CSVs, o LEIA-ME e os links assinados dos ficheiros.
 * O ZIP é montado no cliente (ver `zip-client.ts`). Limite: 3 por hora (na BD).
 */
export async function GET() {
  const supabase = await createClient();
  const { error } = await supabase.rpc("consume_export");
  if (error?.message === "rate_limited") {
    return Response.json(
      { error: "rate_limited", message: limitMessages.export },
      { status: 429, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (error && error.code === "42501") {
    return Response.json({ error: "unauthenticated" }, { status: 401 });
  }
  const manifest = await getExportManifest();
  if (!manifest) {
    return Response.json({ error: "unauthenticated" }, { status: 401 });
  }
  return Response.json(manifest, { headers: { "Cache-Control": "no-store" } });
}
