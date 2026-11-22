import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { ReminderForm } from "@/components/lembretes/reminder-form";
import { todayISO } from "@/lib/dates";
import { getPetReminders } from "@/lib/lembretes/data";

export default function EditarLembretePage({
  params,
}: PageProps<"/animais/[id]/lembretes/[reminderId]">) {
  return (
    <Suspense fallback={<div className="flex-1" aria-hidden />}>
      <Editar params={params} />
    </Suspense>
  );
}

async function Editar({
  params,
}: Pick<PageProps<"/animais/[id]/lembretes/[reminderId]">, "params">) {
  await connection();
  const { id, reminderId } = await params;
  const data = await getPetReminders(id);
  const row = data.active.find((r) => r.id === reminderId);
  // Lembretes de saúde seguem o registo: não se editam aqui.
  if (!row || row.auto || !row.canEdit) notFound();
  return (
    <ReminderForm
      petId={id}
      petName={data.petName}
      today={todayISO()}
      initial={{ id: row.id, title: row.title, ...row.form }}
    />
  );
}
