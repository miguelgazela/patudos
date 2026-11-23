import { PageSkeleton } from "@/components/nav/skeleton";
import { X } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { InviteForm } from "@/components/pessoas/invite-form";
import { getPeople } from "@/lib/people/data";

export default function ConvidarPage({
  params,
}: PageProps<"/animais/[id]/pessoas/convidar">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Convidar params={params} />
    </Suspense>
  );
}

async function Convidar({
  params,
}: {
  params: PageProps<"/animais/[id]/pessoas/convidar">["params"];
}) {
  const { id } = await params;
  const data = await getPeople(id);
  // Só o dono convida.
  if (!data.isOwner) redirect(`/animais/${id}/pessoas`);

  return (
    <>
      <header className="flex items-center gap-3">
        <Link
          href={`/animais/${id}/pessoas`}
          aria-label="Cancelar"
          className="focus-visible:shadow-foco flex size-11 items-center justify-center rounded-full bg-linha-suave text-tinta outline-none"
        >
          <X className="size-6" strokeWidth={2.2} aria-hidden />
        </Link>
        <h1 className="text-[22px] font-extrabold tracking-tight">Convidar</h1>
      </header>
      <p className="text-[22px] leading-tight font-extrabold tracking-tight">
        Quem vai cuidar de {data.petName} contigo?
      </p>
      <InviteForm petId={id} petName={data.petName} />
    </>
  );
}
