import { getExportManifest } from "@/lib/conta/export-data";

/**
 * Exportar os meus dados: devolve o JSON, os CSVs, o LEIA-ME e os links assinados dos ficheiros.
 * O ZIP é montado no cliente (ver `zip-client.ts`).
 */
export async function GET() {
  const manifest = await getExportManifest();
  if (!manifest) {
    return Response.json({ error: "unauthenticated" }, { status: 401 });
  }
  return Response.json(manifest, { headers: { "Cache-Control": "no-store" } });
}
