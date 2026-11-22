"use client";

import { Dialog } from "@base-ui/react/dialog";
import { CalendarPlus, Check, Clock, Copy } from "lucide-react";
import { useState, useTransition } from "react";

import { ErrorBanner } from "@/components/auth/banner";
import { Button, buttonVariants } from "@/components/ui/button";
import { regenerateCalendarLink } from "@/lib/calendario/actions";

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 py-2">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-menta text-etiqueta font-extrabold text-pinheiro-escuro">
        {n}
      </span>
      <p className="pt-1.5 text-corpo">{children}</p>
    </li>
  );
}

export function CalendarioPanel({
  httpsUrl,
  webcalUrl,
}: {
  httpsUrl: string;
  webcalUrl: string;
}) {
  const [copied, setCopied] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function copy() {
    try {
      await navigator.clipboard.writeText(httpsUrl);
    } catch {
      // Sem API de clipboard: seleciona o campo para copiar à mão.
      const el = document.getElementById("calendario-link");
      if (el instanceof HTMLInputElement) {
        el.focus();
        el.select();
      }
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  function regenerate() {
    setError(null);
    startTransition(async () => {
      const res = await regenerateCalendarLink();
      if (res.ok) setConfirm(false);
      else setError(res.message);
    });
  }

  return (
    <div className="flex flex-1 flex-col gap-5" data-testid="calendario-panel">
      <p className="text-corpo text-tinta-suave">
        As datas dos teus animais aparecem no teu calendário: vacinas,
        desparasitações e lembretes.
      </p>
      <p className="flex items-start gap-3 rounded-[20px] bg-aviso-fundo p-4 text-etiqueta text-aviso-banner">
        <Clock
          className="mt-0.5 size-5 shrink-0"
          strokeWidth={2.2}
          aria-hidden
        />
        <span>
          O calendário atualiza com algumas horas de atraso. Usa as notificações
          para não falhar nada.
        </span>
      </p>

      <a
        href={webcalUrl}
        data-testid="calendario-webcal"
        className={buttonVariants({ variant: "default" })}
      >
        <CalendarPlus aria-hidden strokeWidth={2.2} />
        Adicionar ao Calendário do iPhone
      </a>

      <div className="flex flex-col gap-2">
        <label htmlFor="calendario-link" className="text-etiqueta">
          O teu link
        </label>
        <input
          id="calendario-link"
          readOnly
          value={httpsUrl}
          onFocus={(e) => e.currentTarget.select()}
          className="focus-visible:shadow-foco h-14 w-full truncate rounded-[16px] border-[1.5px] border-linha bg-branco px-4 text-[14px] font-semibold text-tinta-suave outline-none"
        />
        <Button type="button" variant="secondary" onClick={copy}>
          {copied ? (
            <Check aria-hidden strokeWidth={2.6} />
          ) : (
            <Copy aria-hidden strokeWidth={2.2} />
          )}
          {copied ? "Copiado" : "Copiar link"}
        </Button>
      </div>

      <section className="flex flex-col gap-1 rounded-cartao border-[1.5px] border-linha bg-branco px-4 py-3">
        <h2 className="text-seccao">Google Calendar</h2>
        <ol className="flex flex-col">
          <Step n={1}>Copia o link acima</Step>
          <Step n={2}>
            No computador, abre o Google Calendar → <b>Outros calendários</b> →{" "}
            <b>+</b> → <b>A partir do URL</b>
          </Step>
          <Step n={3}>
            Cola o link e toca em <b>Adicionar calendário</b>
          </Step>
        </ol>
      </section>

      {error ? <ErrorBanner>{error}</ErrorBanner> : null}

      <Dialog.Root open={confirm} onOpenChange={setConfirm}>
        <Dialog.Trigger render={<Button type="button" variant="destructive" />}>
          Gerar novo link
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-40 bg-[var(--scrim)] transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
          <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 flex w-[calc(100%-48px)] max-w-sm -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-dialogo bg-branco p-6 outline-none">
            <Dialog.Title className="text-seccao">
              Gerar novo link?
            </Dialog.Title>
            <Dialog.Description className="text-corpo text-tinta-suave">
              O link antigo deixa de funcionar. Vais ter de voltar a juntar o
              calendário com o link novo.
            </Dialog.Description>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={regenerate}
                className="focus-visible:shadow-foco h-botao w-full rounded-capsula bg-atraso text-corpo font-extrabold text-branco outline-none disabled:opacity-60"
              >
                {pending ? "A gerar…" : "Gerar novo link"}
              </button>
              <Button
                type="button"
                variant="link"
                className="w-full"
                onClick={() => setConfirm(false)}
              >
                Cancelar
              </Button>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
