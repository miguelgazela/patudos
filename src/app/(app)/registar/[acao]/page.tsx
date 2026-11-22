import { Hourglass } from "lucide-react";
import { notFound } from "next/navigation";

import { BackButton } from "@/components/nav/back-button";
import { EmptyState } from "@/components/nav/empty-state";
import { registarActions } from "@/lib/registar";

export function generateStaticParams() {
  return registarActions.map((a) => ({ acao: a.slug }));
}

// Provisório: os formulários chegam nas próximas fases.
export default async function EmBrevePage({
  params,
}: PageProps<"/registar/[acao]">) {
  const { acao } = await params;
  const action = registarActions.find((a) => a.slug === acao);
  if (!action) notFound();

  return (
    <>
      <BackButton />
      <h1 className="text-ecra tracking-tight">{action.title}</h1>
      <EmptyState icon={Hourglass} title="Em breve">
        Esta parte ainda está a ser preparada.
      </EmptyState>
    </>
  );
}
