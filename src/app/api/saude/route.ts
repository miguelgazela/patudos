import { createClient } from "@supabase/supabase-js";
import { connection } from "next/server";

import type { Database } from "@/lib/database.types";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/env";

// Verificação de saúde para monitorização externa (por exemplo UptimeRobot).
// Responde 200 `{ok:true}` se a BD responde, 503 senão. Não expõe dados nem detalhes do erro.
export async function GET() {
  await connection(); // nunca pré-renderizar: tem de testar a BD a cada pedido
  const headers = { "Cache-Control": "no-store" };
  try {
    const supabase = createClient<Database>(
      supabaseUrl,
      supabasePublishableKey,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data, error } = await supabase.rpc("health_ping");
    if (error || data !== true) {
      return Response.json({ ok: false }, { status: 503, headers });
    }
    return Response.json({ ok: true }, { headers });
  } catch {
    return Response.json({ ok: false }, { status: 503, headers });
  }
}
