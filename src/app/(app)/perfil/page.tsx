import {
  Bell,
  CalendarDays,
  ChevronRight,
  FolderOpen,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { EditNameForm } from "@/components/perfil/edit-name-form";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/actions";
import { getCurrentProfile } from "@/lib/auth/current-profile";

// Perfil (ecrã 29, versão base): nome, email, termos e terminar sessão.
export default function PerfilPage() {
  return (
    <>
      <h1 className="text-ecra tracking-tight">Perfil</h1>
      <Suspense fallback={<div className="flex-1" aria-hidden />}>
        <Perfil />
      </Suspense>
    </>
  );
}

async function Perfil() {
  const profile = await getCurrentProfile();

  return (
    <>
      <EditNameForm name={profile.name ?? ""} />

      <dl className="flex flex-col gap-1 rounded-cartao border-[1.5px] border-linha bg-branco p-4">
        <dt className="text-etiqueta">O teu email</dt>
        <dd className="text-corpo font-semibold break-all text-tinta-suave">
          {profile.email}
        </dd>
      </dl>

      <ul className="overflow-hidden rounded-cartao border-[1.5px] border-linha bg-branco">
        <li className="border-b-[1.5px] border-linha-suave">
          <Link
            href="/perfil/notificacoes"
            className="focus-visible:shadow-foco flex min-h-16 w-full items-center gap-3 px-4 py-3 outline-none"
          >
            <Bell
              className="size-6 text-pinheiro"
              strokeWidth={2.2}
              aria-hidden
            />
            <span className="flex-1 text-corpo font-bold">Notificações</span>
            <ChevronRight
              className="size-5 text-tinta-suave"
              strokeWidth={2.2}
              aria-hidden
            />
          </Link>
        </li>
        <li className="border-b-[1.5px] border-linha-suave">
          <Link
            href="/perfil/calendario"
            className="focus-visible:shadow-foco flex min-h-16 w-full items-center gap-3 px-4 py-3 outline-none"
          >
            <CalendarDays
              className="size-6 text-pinheiro"
              strokeWidth={2.2}
              aria-hidden
            />
            <span className="flex-1 text-corpo font-bold">Calendário</span>
            <ChevronRight
              className="size-5 text-tinta-suave"
              strokeWidth={2.2}
              aria-hidden
            />
          </Link>
        </li>
        <li className="border-b-[1.5px] border-linha-suave">
          <Link
            href="/documentos"
            className="focus-visible:shadow-foco flex min-h-16 w-full items-center gap-3 px-4 py-3 outline-none"
          >
            <FolderOpen
              className="size-6 text-pinheiro"
              strokeWidth={2.2}
              aria-hidden
            />
            <span className="flex-1 text-corpo font-bold">Documentos</span>
            <ChevronRight
              className="size-5 text-tinta-suave"
              strokeWidth={2.2}
              aria-hidden
            />
          </Link>
        </li>
        <li>
          <button
            type="button"
            disabled
            className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left text-desativado-texto"
          >
            <ShieldCheck className="size-6" strokeWidth={2.2} aria-hidden />
            <span className="flex-1 text-corpo font-bold">
              Termos e privacidade
            </span>
            <span className="text-legenda">Em breve</span>
            <ChevronRight className="size-5" strokeWidth={2.2} aria-hidden />
          </button>
        </li>
      </ul>

      <form action={signOut} className="mt-auto">
        <Button type="submit" variant="secondary">
          Terminar sessão
        </Button>
      </form>
    </>
  );
}
