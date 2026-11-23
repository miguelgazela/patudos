import { PageSkeleton } from "@/components/nav/skeleton";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { PeopleList } from "@/components/pessoas/people-list";
import { getPeople } from "@/lib/people/data";

export default function PessoasPage({
  params,
  searchParams,
}: PageProps<"/animais/[id]/pessoas">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Pessoas params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Pessoas({
  params,
  searchParams,
}: Pick<PageProps<"/animais/[id]/pessoas">, "params" | "searchParams">) {
  const { id } = await params;
  const { convite } = await searchParams;
  const data = await getPeople(id);
  const flash =
    convite === "enviado" || convite === "falhou" ? convite : undefined;

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
          Pessoas de {data.petName}
        </h1>
      </header>
      <PeopleList data={data} flash={flash} />
    </>
  );
}
