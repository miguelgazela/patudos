import { Check, ChevronRight, Syringe, UserPlus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PetAvatar } from "@/components/pets/pet-avatar";
import { buttonVariants } from "@/components/ui/button";
import { isPetColor } from "@/lib/pets/constants";
import { signPhotos } from "@/lib/pets/data";
import { createClient } from "@/lib/supabase/server";

export default function CriadoPage({
  params,
}: PageProps<"/animais/[id]/criado">) {
  return (
    <Suspense fallback={<div className="flex-1" aria-hidden />}>
      <Criado params={params} />
    </Suspense>
  );
}

async function Criado({
  params,
}: {
  params: PageProps<"/animais/[id]/criado">["params"];
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: pet } = await supabase
    .from("pets")
    .select("id, name, species, color, photo_path")
    .eq("id", id)
    .maybeSingle();
  if (!pet) notFound();
  const photos = await signPhotos(supabase, [pet.photo_path]);

  return (
    <div className="flex flex-1 flex-col gap-5 pt-8">
      <div className="flex flex-col items-center gap-3.5 text-center">
        <div className="relative">
          <PetAvatar
            name={pet.name}
            color={isPetColor(pet.color) ? pet.color : "laranja"}
            photoUrl={
              pet.photo_path ? (photos.get(pet.photo_path) ?? null) : null
            }
            species={pet.species}
            petId={pet.id}
            className="size-30 text-[52px]"
          />
          <span className="absolute -right-1 -bottom-1 flex size-11 items-center justify-center rounded-full bg-feito text-branco shadow-[0_0_0_4px_var(--color-nevoa)]">
            <Check className="size-6" strokeWidth={2.8} aria-hidden />
          </span>
        </div>
        <h1 className="text-[28px] leading-tight font-extrabold tracking-tight">
          {pet.name} já está no Patudos
        </h1>
        <p className="text-corpo text-tinta-suave">
          Queres adiantar já alguma coisa? É opcional.
        </p>
      </div>

      <Link
        href="/registar/tratamento"
        className="focus-visible:shadow-foco flex items-center gap-3.5 rounded-cartao border-[1.5px] border-linha bg-branco p-4 outline-none"
      >
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-menta text-pinheiro-escuro">
          <Syringe className="size-6" strokeWidth={2.2} aria-hidden />
        </span>
        <span className="flex-1">
          <span className="block text-corpo font-bold">
            Registar as últimas vacinas e desparasitações
          </span>
          <span className="block text-legenda text-tinta-suave">
            Assim o Patudos lembra-te das próximas
          </span>
        </span>
        <ChevronRight className="size-5 text-tinta-suave" aria-hidden />
      </Link>

      {/* Convidar cuidadores chega na Fase 2: por agora fica desativado. */}
      <div
        aria-disabled="true"
        className="flex items-center gap-3.5 rounded-cartao border-[1.5px] border-linha bg-branco p-4 text-desativado-texto"
      >
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-desativado">
          <UserPlus className="size-6" strokeWidth={2.2} aria-hidden />
        </span>
        <span className="flex-1">
          <span className="block text-corpo font-bold">
            Convidar alguém para cuidar de {pet.name}
          </span>
          <span className="block text-legenda">Em breve</span>
        </span>
      </div>

      <Link
        href="/animais"
        className={buttonVariants({
          variant: "secondary",
          className: "mt-auto",
        })}
      >
        Agora não
      </Link>
    </div>
  );
}
