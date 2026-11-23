"use client";

import { safely } from "@/lib/client-action";
import { Ellipsis, Mail, UserPlus } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { ErrorBanner } from "@/components/auth/banner";
import { ConfirmDialog, Sheet, Switch } from "@/components/consulta/ui";
import { buttonVariants } from "@/components/ui/button";
import {
  cancelInvite,
  changeRole,
  leavePet,
  removeMember,
  resendInvite,
  setNotify,
} from "@/lib/people/actions";
import type { PeopleData, Person } from "@/lib/people/data";
import { roleLabel, sentAgo } from "@/lib/people/labels";
import { cn } from "@/lib/utils";

import { PersonAvatar } from "./person-avatar";

const tagClass = "rounded-capsula px-3 py-1 text-legenda font-bold";

const rowBtn =
  "focus-visible:shadow-foco flex min-h-14 w-full items-center gap-3 rounded-campo px-3 text-left text-corpo font-bold outline-none active:bg-linha-suave";

/** Ecrã 20: pessoas do animal. O dono gere; o cuidador só lê (e pode sair). */
export function PeopleList({
  data,
  flash,
}: {
  data: PeopleData;
  flash?: "enviado" | "falhou";
}) {
  const { petId, petName, isOwner, people, invites } = data;
  const me = people.find((p) => p.isMe);
  const [target, setTarget] = useState<Person | null>(null);
  const [removing, setRemoving] = useState<Person | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<{ ok: boolean; message?: string }>) {
    setMessage(null);
    startTransition(async () => {
      const res = await safely(fn);
      if (!res.ok)
        setMessage(res.message ?? "Não conseguimos concluir. Tenta de novo.");
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {flash === "enviado" && !notice ? (
        <p
          role="status"
          className="rounded-banner bg-menta p-4 text-etiqueta text-pinheiro-escuro"
        >
          Convite enviado. A pessoa recebe um email para entrar.
        </p>
      ) : null}
      {flash === "falhou" ? (
        <ErrorBanner>
          O convite ficou criado, mas não conseguimos enviar o email. Toca em
          «Reenviar» para tentar de novo.
        </ErrorBanner>
      ) : null}
      {notice ? (
        <p
          role="status"
          className="rounded-banner bg-menta p-4 text-etiqueta text-pinheiro-escuro"
        >
          {notice}
        </p>
      ) : null}
      {message ? <ErrorBanner>{message}</ErrorBanner> : null}

      <ul className="flex flex-col overflow-hidden rounded-cartao border-[1.5px] border-linha bg-branco">
        {people.map((p) => (
          <li
            key={p.id}
            className="flex min-h-[72px] items-center gap-3 border-b border-linha-suave px-4 py-2 last:border-b-0"
          >
            <PersonAvatar seed={p.id} name={p.name} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-corpo font-bold">
                {p.name}
                {p.isMe ? (
                  <span className="text-legenda font-medium text-tinta-suave">
                    {" "}
                    (tu)
                  </span>
                ) : null}
              </p>
              <p className="truncate text-legenda text-tinta-suave">
                {p.email}
              </p>
            </div>
            <span
              className={cn(
                tagClass,
                p.role === "owner"
                  ? "bg-menta text-pinheiro-escuro"
                  : "bg-linha-suave text-tinta-suave",
              )}
            >
              {roleLabel[p.role]}
            </span>
            {isOwner && !p.isMe ? (
              <button
                type="button"
                aria-label={`Opções para ${p.name}`}
                onClick={() => setTarget(p)}
                className="focus-visible:shadow-foco flex size-11 shrink-0 items-center justify-center rounded-full text-tinta outline-none active:bg-linha-suave"
              >
                <Ellipsis className="size-6" strokeWidth={2.2} aria-hidden />
              </button>
            ) : null}
          </li>
        ))}
      </ul>

      {isOwner && invites.length ? (
        <section className="flex flex-col gap-2" aria-label="Convites à espera">
          <h2 className="text-seccao">
            {invites.length > 1 ? "Convites à espera" : "Convite à espera"}
          </h2>
          {invites.map((i) => (
            <div
              key={i.id}
              className="flex flex-col gap-3 rounded-cartao border-[1.5px] border-linha bg-branco p-4"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-[46px] shrink-0 items-center justify-center rounded-full bg-linha-suave text-tinta-suave">
                  <Mail className="size-[22px]" strokeWidth={2.2} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-corpo font-bold">{i.email}</p>
                  <p className="text-legenda text-tinta-suave">
                    {roleLabel[i.role]} ·{" "}
                    {i.expired ? "expirou" : sentAgo(i.createdAt)}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    run(async () => {
                      const res = await resendInvite(petId, i.id);
                      if (res.ok && res.emailSent) {
                        setNotice(`Convite reenviado para ${i.email}.`);
                        return { ok: true };
                      }
                      return {
                        ok: false,
                        message: res.ok
                          ? "Não conseguimos enviar o email. Tenta de novo."
                          : undefined,
                      };
                    })
                  }
                  className="focus-visible:shadow-foco h-12 rounded-capsula bg-linha-suave text-corpo font-bold outline-none disabled:opacity-60"
                >
                  Reenviar
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => cancelInvite(petId, i.id))}
                  className="focus-visible:shadow-foco h-12 rounded-capsula bg-linha-suave text-corpo font-bold text-atraso outline-none disabled:opacity-60"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ))}
        </section>
      ) : null}

      {isOwner ? (
        <Link
          href={`/animais/${petId}/pessoas/convidar`}
          className={buttonVariants()}
        >
          <UserPlus aria-hidden strokeWidth={2.2} />
          Convidar alguém
        </Link>
      ) : null}

      {me ? (
        <div className="flex items-center gap-3 rounded-cartao border-[1.5px] border-linha bg-branco p-4">
          <div className="flex-1">
            <p className="text-corpo font-bold">
              Receber lembretes deste animal
            </p>
            <p className="text-legenda text-tinta-suave">
              Só para ti. Os lembretes chegam em breve.
            </p>
          </div>
          <NotifySwitch petId={petId} initial={me.notify} />
        </div>
      ) : null}

      <div className="flex flex-col gap-2 rounded-cartao border-[1.5px] border-linha bg-linha-suave p-4 text-etiqueta">
        <p>
          <b>Dono</b> — faz tudo: edita a ficha, convida e remove pessoas,
          arquiva.
        </p>
        <p>
          <b>Cuidador</b> — vê o historial, regista consultas, pesos e despesas,
          e marca lembretes como feitos.
        </p>
      </div>

      {!isOwner ? (
        <button
          type="button"
          onClick={() => setLeaving(true)}
          className="focus-visible:shadow-foco h-botao rounded-capsula border-2 border-atraso-borda bg-branco text-corpo font-extrabold text-atraso outline-none"
        >
          Deixar de cuidar de {petName}
        </button>
      ) : null}

      <Sheet
        open={!!target}
        onOpenChange={(o) => !o && setTarget(null)}
        title={target?.name ?? ""}
      >
        {target ? (
          <ul className="flex flex-col">
            <li>
              <button
                type="button"
                className={rowBtn}
                onClick={() => {
                  const t = target;
                  setTarget(null);
                  run(() =>
                    changeRole(
                      petId,
                      t.id,
                      t.role === "owner" ? "caregiver" : "owner",
                    ),
                  );
                }}
              >
                {target.role === "owner"
                  ? "Passar a cuidador"
                  : "Passar a dono"}
              </button>
            </li>
            <li>
              <button
                type="button"
                className={cn(rowBtn, "text-atraso active:bg-atraso-fundo")}
                onClick={() => {
                  setRemoving(target);
                  setTarget(null);
                }}
              >
                Remover de {petName}
              </button>
            </li>
          </ul>
        ) : null}
      </Sheet>

      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Remover ${removing?.name ?? ""} de ${petName}?`}
        confirmLabel="Remover"
        cancelLabel="Cancelar"
        pending={pending}
        onConfirm={() => {
          const r = removing;
          setRemoving(null);
          if (r) run(() => removeMember(petId, r.id));
        }}
      >
        Deixa de ver {petName} e de receber os lembretes. O que já registou fica
        no historial.
      </ConfirmDialog>

      <ConfirmDialog
        open={leaving}
        onOpenChange={setLeaving}
        title={`Deixar de cuidar de ${petName}?`}
        confirmLabel="Deixar de cuidar"
        cancelLabel="Cancelar"
        pending={pending}
        onConfirm={() => {
          setLeaving(false);
          run(() => leavePet(petId));
        }}
      >
        Deixas de ver {petName} e de receber os lembretes. O que registaste fica
        no historial. Para voltares, tens de ser convidado outra vez.
      </ConfirmDialog>
    </div>
  );
}

function NotifySwitch({ petId, initial }: { petId: string; initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [, startTransition] = useTransition();
  return (
    <Switch
      checked={on}
      label="Receber lembretes deste animal"
      onChange={(v) => {
        setOn(v);
        startTransition(async () => {
          const res = await setNotify(petId, v);
          if (!res.ok) setOn(!v);
        });
      }}
    />
  );
}
