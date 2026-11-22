import { PawPrint } from "lucide-react";
import { Suspense } from "react";

import { EmptyState } from "@/components/nav/empty-state";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { greeting, longDate } from "@/lib/dates";

// Hoje (ecrã 5, versão base): saudação, data e estado vazio.
export default function HojePage() {
  return (
    <Suspense fallback={<div className="flex-1" aria-hidden />}>
      <Hoje />
    </Suspense>
  );
}

async function Hoje() {
  const profile = await getCurrentProfile();
  const now = new Date();

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-ecra tracking-tight">
          {greeting(now)}, {profile.name}
        </h1>
        <p className="text-corpo text-tinta-suave">{longDate(now)}</p>
      </header>
      <EmptyState icon={PawPrint} title="Adiciona o teu primeiro patudo">
        Assim podes registar consultas, vacinas e lembretes.
      </EmptyState>
    </>
  );
}
