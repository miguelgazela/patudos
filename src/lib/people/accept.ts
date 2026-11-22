import "server-only";

import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

/**
 * Aceita os convites pendentes e válidos para o email de quem tem sessão.
 * Chama-se logo depois de entrar (e ao abrir «Animais», para quem já tinha sessão).
 * Nunca falha o fluxo: sem convites, ou com erro, a app segue.
 */
export async function acceptPendingInvites(supabase: Client): Promise<number> {
  try {
    const { data } = await supabase.rpc("accept_pet_invites");
    return data?.length ?? 0;
  } catch {
    return 0;
  }
}
