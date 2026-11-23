import { PageSkeleton } from "@/components/nav/skeleton";
import { connection } from "next/server";
import { Suspense } from "react";

import { ReminderForm } from "@/components/lembretes/reminder-form";
import { lisbonDate, lisbonTime, todayISO } from "@/lib/dates";
import { getPetHeader } from "@/lib/ficha/data";
import { addDaysISO } from "@/lib/vet-visits/next-due";

export default function NovoLembretePage({
  params,
}: PageProps<"/animais/[id]/lembretes/novo">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Novo params={params} />
    </Suspense>
  );
}

async function Novo({
  params,
}: Pick<PageProps<"/animais/[id]/lembretes/novo">, "params">) {
  await connection();
  const { id } = await params;
  const head = await getPetHeader(id);
  const now = new Date();
  const today = todayISO(now);
  // Hoje, na próxima hora certa (depois das 23h, amanhã às 09:00).
  const hour = Number(lisbonTime(now).slice(0, 2)) + 1;
  const on = hour >= 24 ? addDaysISO(lisbonDate(now), 1) : today;
  const at = hour >= 24 ? "09:00" : `${String(hour).padStart(2, "0")}:00`;
  return (
    <ReminderForm
      petId={id}
      petName={head.name}
      today={today}
      initial={{
        title: "",
        on,
        at,
        repeat: { kind: "never", every: 2 },
        channels: ["push", "email"],
      }}
    />
  );
}
