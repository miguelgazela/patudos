import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";

import type { Database } from "@/lib/database.types";

import { supabasePublishableKey, supabaseUrl } from "./env";

export async function createClient() {
  // A sessão depende do pedido (hora, cookies): nunca entra numa pré-renderização.
  await connection();
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Chamado a partir de um Server Component: não pode escrever cookies.
          // O proxy já renova a sessão, por isso é seguro ignorar.
        }
      },
    },
  });
}
