import {
  Archive,
  Bell,
  CalendarDays,
  Download,
  FolderOpen,
  Mail,
  ScrollText,
  UserX,
} from "lucide-react";
import { Suspense } from "react";

import { EditNameForm } from "@/components/perfil/edit-name-form";
import { PushStatus } from "@/components/perfil/push-status";
import {
  PetNotifyList,
  ReminderEmailsSwitch,
} from "@/components/perfil/settings";
import { ControlRow, LinkRow, RowList } from "@/components/nav/list-row";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/actions";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { getPerfilPets } from "@/lib/perfil/data";
import pkg from "../../../../package.json";

function SectionTitle({ children }: { children: string }) {
  return (
    <h2 className="-mb-2 text-etiqueta font-extrabold text-tinta-suave">
      {children}
    </h2>
  );
}

// Perfil (ecrã 29): conta, notificações, lembretes por animal, atalhos e terminar sessão.
export default function PerfilPage() {
  return (
    <>
      <h1 className="text-ecra tracking-tight">Perfil</h1>
      <Suspense fallback={<PerfilSkeleton />}>
        <Perfil />
      </Suspense>
    </>
  );
}

function PerfilSkeleton() {
  return (
    <div
      className="flex flex-col gap-4"
      aria-busy="true"
      aria-label="A carregar"
    >
      <div className="h-24 animate-pulse rounded-cartao bg-esqueleto" />
      <div className="h-36 animate-pulse rounded-cartao bg-esqueleto" />
      <div className="h-40 animate-pulse rounded-cartao bg-esqueleto" />
    </div>
  );
}

async function Perfil() {
  const profile = await getCurrentProfile();
  const { pets, archivedCount } = await getPerfilPets(profile.id);

  return (
    <>
      <EditNameForm name={profile.name ?? ""} email={profile.email} />

      <SectionTitle>Notificações</SectionTitle>
      <RowList>
        <LinkRow
          href="/perfil/notificacoes"
          icon={Bell}
          label="Notificações no iPhone"
          sub={<PushStatus />}
        />
        <ControlRow icon={Mail} label="Emails de lembrete">
          <ReminderEmailsSwitch initial={profile.reminder_emails} />
        </ControlRow>
      </RowList>

      {pets.length > 0 ? (
        <>
          <SectionTitle>Lembretes por animal</SectionTitle>
          <PetNotifyList pets={pets} />
        </>
      ) : null}

      <SectionTitle>Mais</SectionTitle>
      <RowList>
        <LinkRow
          href="/perfil/calendario"
          icon={CalendarDays}
          label="Calendário"
        />
        <LinkRow href="/documentos" icon={FolderOpen} label="Documentos" />
        <LinkRow
          href="/animais/arquivados"
          icon={Archive}
          label="Animais arquivados"
          detail={
            archivedCount > 0 ? (
              <span className="text-legenda text-tinta-suave">
                {archivedCount}
              </span>
            ) : undefined
          }
        />
        <LinkRow
          href="/termos"
          icon={ScrollText}
          label="Termos e privacidade"
        />
        <LinkRow
          href="/perfil/exportar"
          icon={Download}
          label="Exportar os meus dados"
        />
      </RowList>

      <form action={signOut} className="mt-2">
        <Button type="submit" variant="secondary">
          Terminar sessão
        </Button>
      </form>

      <RowList>
        <LinkRow
          href="/perfil/apagar"
          icon={UserX}
          label="Apagar conta"
          danger
        />
      </RowList>

      <p className="text-center text-legenda text-tinta-suave">
        Patudos · versão {pkg.version}
        <br />
        Saúde, lembretes, despesas e documentos dos teus animais.
      </p>
    </>
  );
}
