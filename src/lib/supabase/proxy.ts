import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/lib/database.types";

import { supabasePublishableKey, supabaseUrl } from "./env";

/**
 * Renova a sessão (cookies) em cada pedido e aplica as regras de acesso:
 * sem sessão → /entrar; com sessão, /entrar → /.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    supabaseUrl,
    supabasePublishableKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([key, value]) =>
            response.headers.set(key, value),
          );
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const signedIn = !!data?.claims;
  const { pathname } = request.nextUrl;
  const onEntrar = pathname === "/entrar" || pathname.startsWith("/entrar/");

  if (signedIn === onEntrar) {
    const url = request.nextUrl.clone();
    url.pathname = signedIn ? "/" : "/entrar";
    url.search = "";
    const redirect = NextResponse.redirect(url);
    // Mantém os cookies renovados na resposta de redirecionamento.
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    response.headers.forEach((value, key) => {
      if (
        key.toLowerCase() === "cache-control" ||
        key === "expires" ||
        key === "pragma"
      )
        redirect.headers.set(key, value);
    });
    return redirect;
  }

  return response;
}
