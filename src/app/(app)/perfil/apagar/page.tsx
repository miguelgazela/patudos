import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { DeleteFlow } from "@/components/conta/delete-flow";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { loadPlanPets } from "@/lib/conta/delete-data";
import { classifyPets } from "@/lib/conta/delete-plan";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Apagar conta · Patudos" };

// Apagar conta (ecrã 35): o que acontece a cada animal e confirmação escrita.
export default function ApagarContaPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1" aria-busy="true" aria-label="A carregar" />
      }
    >
      <Apagar />
    </Suspense>
  );
}

async function Apagar() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const pets = classifyPets(
    await loadPlanPets(supabase, profile.id),
    profile.id,
  );

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
          Apagar conta
        </h1>
      </header>
      <DeleteFlow pets={pets} />
    </>
  );
}
