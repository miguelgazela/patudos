"use client";

import { showToast } from "@/components/ui/toast";
import { safely } from "@/lib/client-action";
import { Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { ErrorBanner } from "@/components/auth/banner";
import { TextField } from "@/components/auth/text-field";
import { Chip } from "@/components/consulta/ui";
import { Button } from "@/components/ui/button";
import { saveReminder } from "@/lib/lembretes/actions";
import { REPEAT_OPTIONS, type Repeat } from "@/lib/lembretes/recurrence";
import {
  CHANNEL_LABEL,
  CHANNELS,
  SUGGESTIONS,
  type Channel,
} from "@/lib/lembretes/schema";

export type ReminderFormValues = {
  id?: string;
  title: string;
  on: string;
  at: string;
  repeat: Repeat;
  channels: Channel[];
};

/** Ecrã 23 — novo / editar lembrete (data e hora em Europe/Lisbon). */
export function ReminderForm({
  petId,
  petName,
  initial,
  today,
}: {
  petId: string;
  petName: string;
  initial: ReminderFormValues;
  today: string;
}) {
  const router = useRouter();
  const back = `/animais/${petId}/lembretes`;
  const [title, setTitle] = useState(initial.title);
  const [on, setOn] = useState(initial.on);
  const [at, setAt] = useState(initial.at);
  const [repeat, setRepeat] = useState<Repeat>(initial.repeat);
  const [channels, setChannels] = useState<Channel[]>(initial.channels);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(c: Channel) {
    setChannels((cur) =>
      cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c],
    );
  }

  function save() {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const res = await safely(() =>
        saveReminder({
          id: initial.id,
          pet_id: petId,
          title,
          on,
          at,
          repeat,
          channels,
        }),
      );
      if (!res.ok) {
        setErrors(res.errors ?? {});
        setError(res.message);
        return;
      }
      showToast(initial.id ? "Lembrete guardado" : "Lembrete criado");
      router.push(back);
    });
  }

  return (
    <>
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push(back)}
          aria-label="Fechar"
          className="focus-visible:shadow-foco flex size-11 items-center justify-center rounded-full bg-linha-suave text-tinta outline-none"
        >
          <X className="size-6" strokeWidth={2.2} aria-hidden />
        </button>
        <h1 className="text-[22px] font-extrabold tracking-tight">
          {initial.id ? "Editar lembrete" : "Novo lembrete"}
          <span className="block text-legenda font-semibold text-tinta-suave">
            {petName}
          </span>
        </h1>
      </header>

      <form
        className="flex flex-col gap-5 pb-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="flex flex-col gap-2">
          <TextField
            id="lembrete-titulo"
            name="title"
            label="O quê?"
            value={title}
            maxLength={80}
            autoComplete="off"
            autoCapitalize="sentences"
            placeholder="Ex.: Comprar ração"
            onChange={(e) => setTitle(e.target.value)}
            error={errors.title}
          />
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <Chip
                key={s}
                selected={title === s}
                onClick={() => setTitle(title === s ? "" : s)}
              >
                {s}
              </Chip>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <TextField
            id="lembrete-dia"
            name="on"
            type="date"
            label="Dia"
            value={on}
            min={initial.id ? undefined : today}
            onChange={(e) => setOn(e.target.value)}
            error={errors.on}
          />
          <TextField
            id="lembrete-hora"
            name="at"
            type="time"
            label="Hora"
            value={at}
            onChange={(e) => setAt(e.target.value)}
            error={errors.at}
          />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-etiqueta">Repetir</span>
          <div className="flex flex-wrap gap-2">
            {REPEAT_OPTIONS.map((o) => (
              <Chip
                key={o.kind}
                selected={repeat.kind === o.kind}
                onClick={() => setRepeat((r) => ({ ...r, kind: o.kind }))}
              >
                {o.label}
              </Chip>
            ))}
          </div>
          {repeat.kind === "everyMonths" ? (
            <TextField
              id="lembrete-meses"
              label="De quantos em quantos meses?"
              inputMode="numeric"
              value={String(repeat.every)}
              onChange={(e) =>
                setRepeat((r) => ({
                  ...r,
                  every: Number(e.target.value.replace(/\D/g, "")) || 0,
                }))
              }
              error={errors["repeat.every"]}
            />
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-etiqueta">Avisar por</span>
          <div className="flex flex-wrap gap-2">
            {CHANNELS.map((c) => {
              const on = channels.includes(c);
              return (
                <Chip key={c} selected={on} onClick={() => toggle(c)}>
                  {on ? (
                    <Check
                      className="mr-1.5 size-4"
                      strokeWidth={3}
                      aria-hidden
                    />
                  ) : null}
                  {CHANNEL_LABEL[c]}
                </Chip>
              );
            })}
          </div>
          <p className="text-legenda text-tinta-suave">
            Os avisos chegam só a quem tiver os lembretes ligados.
          </p>
        </div>

        {error ? <ErrorBanner>{error}</ErrorBanner> : null}
        <Button type="submit" disabled={pending}>
          Guardar
        </Button>
      </form>
    </>
  );
}
