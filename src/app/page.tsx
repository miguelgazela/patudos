import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/actions";
import { getCurrentProfile } from "@/lib/auth/current-profile";

// Hoje (provisório): só a saudação e «Terminar sessão» até ao ecrã completo.
export default function HojePage() {
  return (
    <AuthShell>
      <Suspense fallback={<div className="flex-1" aria-hidden />}>
        <Hoje />
      </Suspense>
    </AuthShell>
  );
}

async function Hoje() {
  const profile = await getCurrentProfile();
  if (!profile.name) redirect("/bem-vindo");

  return (
    <>
      <h1 className="text-ecra tracking-tight">Bom dia, {profile.name}</h1>
      <form action={signOut} className="mt-auto">
        <Button type="submit" variant="secondary">
          Terminar sessão
        </Button>
      </form>
    </>
  );
}
