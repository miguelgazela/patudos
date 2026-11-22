import { ArrowLeft } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";

import { CalendarioPanel } from "@/components/perfil/calendario-panel";
import { createClient } from "@/lib/supabase/server";

// Ligar ao calendário (ecrã 30): link secreto do feed .ics, criado no primeiro acesso.
export default function CalendarioPage() {
  return (
    <>
      <header className="flex items-center gap-3">
        <Link
          href="/perfil"
          aria-label="Voltar"
          className="focus-visible:shadow-foco flex size-11 items-center justify-center rounded-full bg-linha-suave text-tinta outline-none"
        >
          <ArrowLeft className="size-6" strokeWidth={2.2} aria-hidden />
        </Link>
        <h1 className="text-[22px] font-extrabold tracking-tight">
          Calendário
        </h1>
      </header>
      <Suspense
        fallback={<div className="flex-1" aria-busy aria-label="A carregar" />}
      >
        <LinkCalendario />
      </Suspense>
    </>
  );
}

async function LinkCalendario() {
  const supabase = await createClient();
  const { data: token } = await supabase.rpc("get_calendar_token");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.")
      ? "http"
      : "https");
  if (!token) {
    return (
      <p className="text-corpo text-tinta-suave">
        Não conseguimos gerar o link. Volta a abrir este ecrã.
      </p>
    );
  }
  const path = `/api/calendario/${token}.ics`;
  return (
    <CalendarioPanel
      httpsUrl={`${proto}://${host}${path}`}
      webcalUrl={`webcal://${host}${path}`}
    />
  );
}
