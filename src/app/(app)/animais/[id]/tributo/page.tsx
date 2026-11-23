import { PageSkeleton } from "@/components/nav/skeleton";
import { ArrowLeft, HeartPulse, Pencil, UserPlus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { PetAvatar } from "@/components/pets/pet-avatar";
import { UndoDeceased } from "@/components/tributo/undo-deceased";
import { Memories } from "@/components/tributo/memories";
import { buttonVariants } from "@/components/ui/button";
import { speciesLabel } from "@/lib/pets/labels";
import { formatPartialDate } from "@/lib/pets/tribute";
import { getTribute } from "@/lib/pets/tribute-data";

// Ecrã 36: tributo. Foto, nome, datas, as palavras do dono e as memórias de quem cuidou.
export default function TributoPage({
  params,
}: PageProps<"/animais/[id]/tributo">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Tributo params={params} />
    </Suspense>
  );
}

async function Tributo({
  params,
}: {
  params: PageProps<"/animais/[id]/tributo">["params"];
}) {
  const { id } = await params;
  const t = await getTribute(id);

  return (
    <>
      <Link
        href="/animais"
        className="focus-visible:shadow-foco -ml-2 flex h-12 w-fit items-center gap-2 rounded-capsula px-2 text-corpo font-extrabold text-pinheiro outline-none"
      >
        <ArrowLeft className="size-6" strokeWidth={2.2} aria-hidden />
        Animais
      </Link>

      <header className="flex flex-col items-center gap-3 pt-2 text-center">
        <PetAvatar
          name={t.name}
          color={t.color}
          photoUrl={t.photoUrl}
          species={t.species}
          petId={t.id}
          className="size-40 text-[56px]"
        />
        <p className="text-[13px] font-extrabold tracking-[.06em] text-tinta-suave uppercase">
          Em memória
        </p>
        <h1 className="text-ecra tracking-tight [overflow-wrap:anywhere]">
          {t.name}
        </h1>
        <p className="text-seccao">{t.lifeSpan}</p>
        <p className="text-legenda text-tinta-suave">
          {speciesLabel(t.species, t.sex)}
          {t.breed ? ` · ${t.breed}` : ""}
          {" · "}
          Faleceu {t.precision === "day" ? "a" : "em"}{" "}
          {formatPartialDate(t.deceasedOn, t.precision)}
        </p>
      </header>

      {t.text ? (
        <p className="rounded-cartao border-[1.5px] border-linha bg-branco p-4 text-corpo [overflow-wrap:anywhere] whitespace-pre-wrap">
          {t.text}
        </p>
      ) : t.isOwner ? (
        <Link
          href={`/animais/${t.id}/tributo/editar`}
          className="rounded-cartao border-[1.5px] border-dashed border-linha px-4 py-5 text-corpo text-tinta-suave"
        >
          Escreve umas palavras sobre {t.name}, se quiseres.
        </Link>
      ) : null}

      <Memories petId={t.id} name={t.name} memories={t.memories} />

      <div className="flex flex-col gap-3">
        <Link
          href={`/animais/${t.id}`}
          className={buttonVariants({ variant: "secondary" })}
        >
          <HeartPulse aria-hidden strokeWidth={2.2} />
          Ver o historial de saúde
        </Link>
        {t.isOwner ? (
          <>
            <Link
              href={`/animais/${t.id}/pessoas/convidar`}
              className={buttonVariants({ variant: "secondary" })}
            >
              <UserPlus aria-hidden strokeWidth={2.2} />
              Partilhar com quem conheceu {t.name}
            </Link>
            <Link
              href={`/animais/${t.id}/tributo/editar`}
              className={buttonVariants({ variant: "link" })}
            >
              <Pencil aria-hidden strokeWidth={2.2} className="size-5" />
              Editar o tributo
            </Link>
            <UndoDeceased petId={t.id} name={t.name} />
          </>
        ) : null}
      </div>
    </>
  );
}
