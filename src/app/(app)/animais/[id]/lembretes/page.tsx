import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { ReminderList } from "@/components/lembretes/reminder-list";
import { getPetReminders } from "@/lib/lembretes/data";

export default function LembretesPage({
  params,
}: PageProps<"/animais/[id]/lembretes">) {
  return (
    <Suspense fallback={<div className="flex-1" aria-hidden />}>
      <Lembretes params={params} />
    </Suspense>
  );
}

async function Lembretes({
  params,
}: Pick<PageProps<"/animais/[id]/lembretes">, "params">) {
  await connection();
  const { id } = await params;
  const data = await getPetReminders(id);
  return (
    <>
      <header className="flex items-center gap-3">
        <Link
          href={`/animais/${id}`}
          aria-label="Voltar"
          className="focus-visible:shadow-foco flex size-11 items-center justify-center rounded-full bg-linha-suave text-tinta outline-none"
        >
          <ArrowLeft className="size-6" strokeWidth={2.2} aria-hidden />
        </Link>
        <h1 className="text-[22px] font-extrabold tracking-tight">
          Lembretes de {data.petName}
        </h1>
      </header>
      <ReminderList data={data} />
    </>
  );
}
