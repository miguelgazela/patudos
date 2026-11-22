import { ChevronRight, Stethoscope } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { BackButton } from "@/components/nav/back-button";
import { PetAvatar } from "@/components/pets/pet-avatar";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { formatISODate } from "@/lib/dates";
import { isPetColor } from "@/lib/pets/constants";
import { signPhotos } from "@/lib/pets/data";
import { createClient } from "@/lib/supabase/server";

// Provisório (passo 5 da Fase 1): a ficha completa com resumo e cronologia chega depois.
// Por agora lista as consultas, para ver o que foi registado e abrir a edição.
export default function AnimalPage({ params }: PageProps<"/animais/[id]">) {
  return (
    <Suspense fallback={<div className="flex-1" aria-hidden />}>
      <Animal params={params} />
    </Suspense>
  );
}

async function Animal({
  params,
}: {
  params: PageProps<"/animais/[id]">["params"];
}) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: pet } = await supabase
    .from("pets")
    .select("id, name, species, color, photo_path")
    .eq("id", id)
    .maybeSingle();
  if (!pet) notFound();

  const [{ data: visits }, { data: member }, photos] = await Promise.all([
    supabase
      .from("vet_visits")
      .select("id, visited_on, reason, vet_name, created_by")
      .eq("pet_id", id)
      .order("visited_on", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("pet_members")
      .select("role")
      .eq("pet_id", id)
      .eq("user_id", profile.id)
      .maybeSingle(),
    signPhotos(supabase, [pet.photo_path]),
  ]);
  const isOwner = member?.role === "owner";

  return (
    <>
      <BackButton />
      <header className="flex items-center gap-4">
        <PetAvatar
          name={pet.name}
          color={isPetColor(pet.color) ? pet.color : "laranja"}
          photoUrl={
            pet.photo_path ? (photos.get(pet.photo_path) ?? null) : null
          }
          species={pet.species}
          petId={pet.id}
          className="size-16 text-[26px]"
        />
        <h1 className="text-ecra tracking-tight">{pet.name}</h1>
      </header>

      <Link
        href={`/registar/peso?animal=${pet.id}`}
        className={buttonVariants({ variant: "secondary" })}
      >
        Registar peso
      </Link>

      <section className="flex flex-col gap-3" aria-labelledby="consultas">
        <h2 id="consultas" className="text-seccao">
          Consultas
        </h2>
        {visits?.length ? (
          <ul className="overflow-hidden rounded-cartao border-[1.5px] border-linha bg-branco">
            {visits.map((v) => {
              const editable = isOwner || v.created_by === profile.id;
              const inner = (
                <>
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-menta text-pinheiro-escuro">
                    <Stethoscope
                      className="size-5"
                      strokeWidth={2.2}
                      aria-hidden
                    />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[17px] font-bold">
                      {v.reason ?? "Consulta"}
                    </span>
                    <span className="truncate text-legenda text-tinta-suave">
                      {formatISODate(v.visited_on)}
                      {v.vet_name ? ` · ${v.vet_name}` : ""}
                    </span>
                  </span>
                  {editable ? (
                    <ChevronRight
                      className="size-5 shrink-0 text-tinta-suave"
                      strokeWidth={2.2}
                      aria-hidden
                    />
                  ) : null}
                </>
              );
              const cls =
                "flex min-h-16 items-center gap-3 border-b-[1.5px] border-linha-suave px-3.5 py-3 last:border-b-0";
              return (
                <li key={v.id}>
                  {editable ? (
                    <Link
                      href={`/registar/consulta/${v.id}`}
                      className={`${cls} focus-visible:shadow-foco outline-none`}
                    >
                      {inner}
                    </Link>
                  ) : (
                    <div className={cls}>{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-corpo text-tinta-suave">
            Ainda sem consultas registadas.
          </p>
        )}
        <Link
          href="/registar/consulta"
          className={buttonVariants({ variant: "secondary" })}
        >
          Registar consulta
        </Link>
      </section>

      <p className="text-legenda text-tinta-suave">
        A ficha completa, com resumo, cronologia e peso, chega em breve.
      </p>
    </>
  );
}
