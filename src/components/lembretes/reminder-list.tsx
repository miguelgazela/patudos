"use client";

import { Bell, Pause, Pencil, Play, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { ConfirmDialog, Sheet, Switch } from "@/components/consulta/ui";
import { buttonVariants } from "@/components/ui/button";
import { deleteReminder, setReminderActive } from "@/lib/lembretes/actions";
import type { PetRemindersData, ReminderRow } from "@/lib/lembretes/data";
import { setNotify } from "@/lib/people/actions";
import { cn } from "@/lib/utils";

const rowBtn =
  "focus-visible:shadow-foco flex min-h-14 w-full items-center gap-3 rounded-campo px-3 text-left text-corpo font-bold outline-none active:bg-linha-suave";

/** Ecrã 22 — lembretes do animal. */
export function ReminderList({ data }: { data: PetRemindersData }) {
  const [notify, setNotifyState] = useState(data.notify);
  const [target, setTarget] = useState<ReminderRow | null>(null);
  const [confirm, setConfirm] = useState<ReminderRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggleNotify(v: boolean) {
    setNotifyState(v);
    startTransition(async () => {
      const res = await setNotify(data.petId, v);
      if (!res.ok) setNotifyState(!v);
    });
  }

  function run(fn: () => Promise<{ ok: boolean; message?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.message ?? "Não conseguimos guardar.");
    });
  }

  const base = `/animais/${data.petId}/lembretes`;

  return (
    <>
      <div className="flex items-center gap-3 rounded-cartao bg-menta p-4">
        <div className="flex-1">
          <p className="text-seccao">Receber lembretes de {data.petName}</p>
          <p className="text-legenda text-pinheiro-escuro">
            Só muda para ti. Os outros escolhem por eles.
          </p>
        </div>
        <Switch
          checked={notify}
          onChange={toggleNotify}
          label={`Receber lembretes de ${data.petName}`}
        />
      </div>

      <Link href={`${base}/novo`} className={buttonVariants()}>
        <Plus aria-hidden strokeWidth={2.8} />
        Novo lembrete
      </Link>

      {error ? (
        <p role="alert" className="text-etiqueta text-atraso">
          {error}
        </p>
      ) : null}

      {data.active.length ? (
        <ul
          data-testid="lista-lembretes"
          className="overflow-hidden rounded-cartao border-[1.5px] border-linha bg-branco"
        >
          {data.active.map((r) => (
            <li
              key={r.id}
              className="border-b-[1.5px] border-linha-suave last:border-b-0"
            >
              <button
                type="button"
                onClick={() => setTarget(r)}
                className="focus-visible:shadow-foco flex min-h-[68px] w-full items-center gap-3 px-3.5 py-3 text-left outline-none active:bg-linha-suave"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-menta text-pinheiro-escuro">
                  <Bell className="size-5" strokeWidth={2.2} aria-hidden />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span
                    className={cn(
                      "truncate text-[17px] font-bold",
                      r.paused && "text-tinta-suave",
                    )}
                  >
                    {r.title}
                  </span>
                  <span className="text-legenda text-tinta-suave">
                    {r.detail}
                  </span>
                </span>
                {r.paused ? (
                  <span className="shrink-0 rounded-capsula bg-desativado px-2.5 py-1 text-legenda text-tinta-suave">
                    Pausado
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-cartao border-[1.5px] border-dashed border-linha px-4 py-5 text-corpo text-tinta-suave">
          Ainda não há lembretes. Quando registares uma vacina ou uma
          desparasitação com próxima data, o lembrete aparece aqui.
        </p>
      )}

      {data.ended.length ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-seccao">Terminados</h2>
          <ul className="overflow-hidden rounded-cartao border-[1.5px] border-linha bg-branco">
            {data.ended.map((r) => (
              <li
                key={r.id}
                className="flex flex-col border-b-[1.5px] border-linha-suave px-3.5 py-3 last:border-b-0"
              >
                <span className="truncate text-[17px] font-bold text-tinta-suave">
                  {r.title}
                </span>
                <span className="text-legenda text-tinta-suave">
                  {r.detail}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Sheet
        open={!!target}
        onOpenChange={(o) => !o && setTarget(null)}
        title={target?.title ?? ""}
      >
        {target ? (
          <ul className="flex flex-col">
            {!target.auto && target.canEdit ? (
              <li>
                <Link
                  href={`${base}/${target.id}`}
                  onClick={() => setTarget(null)}
                  className={rowBtn}
                >
                  <Pencil
                    className="size-6 text-pinheiro"
                    strokeWidth={2.2}
                    aria-hidden
                  />
                  Editar
                </Link>
              </li>
            ) : null}
            {target.canEdit ? (
              <>
                <li>
                  <button
                    type="button"
                    className={rowBtn}
                    onClick={() => {
                      const t = target;
                      setTarget(null);
                      run(() => setReminderActive(t.id, t.paused));
                    }}
                  >
                    {target.paused ? (
                      <Play
                        className="size-6 text-pinheiro"
                        strokeWidth={2.2}
                        aria-hidden
                      />
                    ) : (
                      <Pause
                        className="size-6 text-pinheiro"
                        strokeWidth={2.2}
                        aria-hidden
                      />
                    )}
                    {target.paused ? "Retomar" : "Pausar"}
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className={cn(rowBtn, "text-atraso active:bg-atraso-fundo")}
                    onClick={() => {
                      setConfirm(target);
                      setTarget(null);
                    }}
                  >
                    <Trash2 className="size-6" strokeWidth={2.2} aria-hidden />
                    Apagar
                  </button>
                </li>
              </>
            ) : (
              <li className="px-3 py-3 text-corpo text-tinta-suave">
                Só o dono ou quem criou o lembrete o pode alterar.
              </li>
            )}
          </ul>
        ) : null}
      </Sheet>

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Apagar «${confirm?.title ?? ""}»?`}
        confirmLabel="Apagar"
        cancelLabel="Cancelar"
        pending={pending}
        onConfirm={() => {
          const c = confirm;
          setConfirm(null);
          if (c) run(() => deleteReminder(c.id));
        }}
      >
        {confirm?.auto
          ? "O lembrete deixa de aparecer, mas o registo de saúde fica guardado."
          : "O lembrete e as suas datas deixam de existir."}
      </ConfirmDialog>
    </>
  );
}
