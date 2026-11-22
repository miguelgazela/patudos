import "server-only";
import { cookies } from "next/headers";
import { z } from "zod";

import { supabaseUrl } from "@/lib/supabase/env";

const COOKIE = "patudos_login";
/** O código vale 1 hora (supabase/config.toml: otp_expiry). */
export const CODE_VALIDITY_MS = 60 * 60 * 1000;

const pendingSchema = z.object({ email: z.string(), sentAt: z.number() });
export type PendingLogin = z.infer<typeof pendingSchema>;

/** Guarda o email e a hora de envio entre o ecrã do email e o do código. */
export async function savePendingLogin(email: string) {
  (await cookies()).set(COOKIE, JSON.stringify({ email, sentAt: Date.now() }), {
    httpOnly: true,
    sameSite: "lax",
    // O WebKit não guarda cookies `secure` em http://localhost (Supabase local).
    secure: supabaseUrl.startsWith("https://"),
    path: "/",
    maxAge: 60 * 60 * 24,
  });
}

export async function readPendingLogin(): Promise<PendingLogin | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = pendingSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function clearPendingLogin() {
  (await cookies()).delete(COOKIE);
}
