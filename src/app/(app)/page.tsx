import { PawPrint, Stethoscope } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { HojeList } from "@/components/hoje/hoje-list";
import { PushPrompt } from "@/components/hoje/push-prompt";
import { EmptyState } from "@/components/nav/empty-state";
import { InstallHint } from "@/components/pwa/install-hint";
import { PetAvatar } from "@/components/pets/pet-avatar";
import { buttonVariants } from "@/components/ui/button";
import { greeting, longDate, todayISO } from "@/lib/dates";
import { getHoje } from "@/lib/lembretes/data";

// Hoje (ecrã 5): em atraso · hoje · próximos 30 dias, de todos os animais.
export default function HojePage({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<HojeSkeleton />}>
      <Hoje searchParams={searchParams} />
    </Suspense>
  );
}

function HojeSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy aria-label="A carregar">
      <div className="flex flex-col gap-2">
        <div className="h-9 w-56 animate-pulse rounded-campo bg-esqueleto" />
        <div className="h-5 w-40 animate-pulse rounded-campo bg-esqueleto" />
      </div>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-[150px] animate-pulse rounded-cartao bg-esqueleto"
        />
      ))}
    </div>
  );
}

async function Hoje({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  await connection();
  const data = await getHoje();
  // Vem do toque numa notificação ou do botão do email: abre logo a confirmação «Feito».
  const { ocorrencia } = await searchParams;
  const focusId = typeof ocorrencia === "string" ? ocorrencia : null;
  const now = new Date();
  const pets = Object.values(data.pets);

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-ecra tracking-tight">
          {greeting(now)}, {data.name}
        </h1>
        <p className="text-corpo text-tinta-suave">{longDate(now)}</p>
      </header>

      <InstallHint />

      {!data.hasPets ? (
        <EmptyState
          icon={PawPrint}
          title="Adiciona o teu primeiro patudo"
          action={
            <Link href="/animais/novo" className={buttonVariants()}>
              Adicionar animal
            </Link>
          }
        >
          Assim podes registar consultas, vacinas e lembretes.
        </EmptyState>
      ) : (
        <>
          <ul className="-mx-5 flex gap-5 overflow-x-auto px-5 py-1.5">
            {pets.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/animais/${p.id}`}
                  className="focus-visible:shadow-foco flex w-16 flex-col items-center gap-1.5 rounded-campo outline-none"
                >
                  <PetAvatar
                    name={p.name}
                    color={p.color}
                    photoUrl={p.photoUrl}
                    species={p.species}
                    petId={p.id}
                    className="size-[60px] text-[22px]"
                  />
                  <b className="max-w-full truncate text-legenda">{p.name}</b>
                </Link>
              </li>
            ))}
          </ul>
          {!data.hasPush &&
          (data.groups.overdue.length ||
            data.groups.today.length ||
            data.groups.upcoming.length) ? (
            <PushPrompt />
          ) : null}
          <HojeList
            focusId={focusId}
            groups={data.groups}
            pets={data.pets}
            treatments={data.treatments}
            names={data.names}
            today={todayISO(now)}
            nowMs={now.getTime()}
            allClear={
              <p className="text-seccao text-pinheiro-escuro">
                Está tudo em dia 🐾
              </p>
            }
            clearAction={
              <Link
                href="/registar/consulta"
                className={buttonVariants({ size: "auto" })}
              >
                <Stethoscope aria-hidden strokeWidth={2.2} />
                Registar consulta
              </Link>
            }
          />
        </>
      )}
    </>
  );
}
