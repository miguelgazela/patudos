import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Tudo exceto ficheiros estáticos, ícones e o feed .ics (autentica-se pelo token no URL).
  matcher: [
    "/((?!_next/static|_next/image|api/calendario/|icons/|favicon.ico|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
