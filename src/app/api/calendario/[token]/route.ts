import { createClient } from "@supabase/supabase-js";

import { buildIcs, type FeedEvent } from "@/lib/calendario/ics";
import type { Database } from "@/lib/database.types";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/env";

type RawEvent = {
  uid: string;
  pet_name: string;
  title: string;
  starts_at: string;
  all_day: boolean;
  local_date: string;
};

const NOT_FOUND = () =>
  new Response("Não encontrado", {
    status: 404,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "private, no-store",
    },
  });

// Feed de calendário: o token no URL é a única credencial. Usa só a chave publishable;
// a função `calendar_feed` valida o token na base de dados (sem service role).
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token: raw } = await params;
  const token = raw.replace(/\.ics$/i, "");
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(token)) return NOT_FOUND();

  const supabase = createClient<Database>(supabaseUrl, supabasePublishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.rpc("calendar_feed", {
    p_token: token,
  });
  // Token inexistente e erro devolvem o mesmo 404: não revela se o token existe.
  if (error || !data) return NOT_FOUND();

  const raws = (data as { events: RawEvent[] }).events;
  const events: FeedEvent[] = raws.map((e) => ({
    uid: e.uid,
    petName: e.pet_name,
    title: e.title,
    startsAt: e.starts_at,
    allDay: e.all_day,
    localDate: e.local_date,
  }));

  const ics = buildIcs(events, { appUrl: new URL(request.url).origin });
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="patudos.ics"',
      // Curto e privado: o link é secreto, não deve ficar em caches partilhadas.
      "Cache-Control": "private, max-age=300",
    },
  });
}
