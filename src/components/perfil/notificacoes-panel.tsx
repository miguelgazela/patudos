"use client";

import {
  BellOff,
  BellRing,
  Check,
  Mail,
  Share,
  SquarePlus,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

import { ErrorBanner } from "@/components/auth/banner";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  removePushSubscription,
  savePushSubscription,
  sendTestNotification,
} from "@/lib/push/actions";
import {
  isIOSDevice,
  pushState,
  urlBase64ToUint8Array,
  type PushState,
} from "@/lib/push/state";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export type Detected = { state: PushState; endpoint: string | null };

/** Lê o estado real do browser (corre só no cliente). */
export async function detect(): Promise<Detected> {
  const hasPushApi =
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window &&
    !!VAPID_PUBLIC_KEY;
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  let endpoint: string | null = null;
  if (hasPushApi) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      endpoint = sub?.endpoint ?? null;
    } catch {
      endpoint = null;
    }
  }
  return {
    endpoint,
    state: pushState({
      isIOS: isIOSDevice(navigator.userAgent, navigator.maxTouchPoints),
      standalone,
      hasPushApi,
      permission:
        "Notification" in window ? Notification.permission : "unsupported",
      subscribed: endpoint !== null,
    }),
  };
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 py-2">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-menta text-etiqueta font-extrabold text-pinheiro-escuro">
        {n}
      </span>
      <p className="text-corpo">{children}</p>
    </li>
  );
}

function Notice({
  tone,
  icon: Icon,
  children,
}: {
  tone: "mint" | "sun";
  icon: typeof Mail;
  children: React.ReactNode;
}) {
  return (
    <p
      className={
        tone === "mint"
          ? "flex items-start gap-3 rounded-banner bg-menta p-4 text-etiqueta text-pinheiro-escuro"
          : "flex items-start gap-3 rounded-banner bg-aviso-fundo p-4 text-etiqueta text-aviso-banner"
      }
    >
      <Icon className="mt-0.5 size-5 shrink-0" strokeWidth={2.2} aria-hidden />
      <span>{children}</span>
    </p>
  );
}

function FakeNotification({
  title,
  body,
  dim,
}: {
  title: string;
  body: string;
  dim?: boolean;
}) {
  return (
    <div
      className={`flex items-start gap-3 rounded-[22px] bg-branco px-3.5 py-3 shadow-[0_8px_24px_rgba(14,31,28,.12)] ${dim ? "scale-95 opacity-75" : ""}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/icons/icon-192.png"
        alt=""
        width={38}
        height={38}
        className="size-[38px] rounded-[10px]"
      />
      <div className="min-w-0 flex-1">
        <div className="flex justify-between gap-2">
          <b className="truncate text-[15px]">{title}</b>
          <span className="shrink-0 text-[12px] text-tinta-suave">agora</span>
        </div>
        <p className="text-[15px] font-medium">{body}</p>
      </div>
    </div>
  );
}

export function NotificacoesPanel() {
  const [detected, setDetected] = useState<Detected>({
    state: "checking",
    endpoint: null,
  });
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let live = true;
    detect().then((d) => {
      if (live) setDetected(d);
    });
    return () => {
      live = false;
    };
  }, []);

  function refresh() {
    detect().then(setDetected);
  }

  function enable() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        // O pedido de permissão tem de nascer do toque do utilizador.
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          refresh();
          return;
        }
        const reg =
          (await navigator.serviceWorker.getRegistration()) ??
          (await navigator.serviceWorker.register("/sw.js"));
        await navigator.serviceWorker.ready;
        const sub =
          (await reg.pushManager.getSubscription()) ??
          (await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
          }));
        const json = sub.toJSON();
        const res = await savePushSubscription({
          endpoint: sub.endpoint,
          keys: json.keys,
          userAgent: navigator.userAgent,
        });
        if (!res.ok) {
          setError(res.message);
          return;
        }
        refresh();
      } catch {
        setError("Não conseguimos ativar as notificações. Tenta de novo.");
      }
    });
  }

  function disable() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager.getSubscription();
        if (sub) {
          await removePushSubscription(sub.endpoint);
          await sub.unsubscribe();
        }
        refresh();
      } catch {
        setError("Não conseguimos desligar as notificações. Tenta de novo.");
      }
    });
  }

  function test() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await sendTestNotification();
      if (!res.ok) setError(res.message);
      else if (res.sent === 0)
        setError(
          "Não encontrámos nenhum dispositivo ligado. Desliga e volta a ativar.",
        );
      else setMessage("Enviada. Deves recebê-la dentro de instantes.");
    });
  }

  const { state } = detected;

  if (state === "checking") {
    return <div className="flex-1" aria-busy aria-label="A carregar" />;
  }

  if (state === "install") {
    return (
      <div
        className="flex flex-1 flex-col gap-5"
        data-testid="notificacoes-install"
      >
        <h2 className="text-titulo tracking-tight">
          Instala o Patudos primeiro
        </h2>
        <p className="text-corpo text-tinta-suave">
          No iPhone, as notificações só funcionam com a app no ecrã principal
          (iOS 16.4 ou superior).
        </p>
        <ol className="flex flex-col rounded-cartao border-[1.5px] border-linha bg-branco px-4 py-2">
          <Step n={1}>
            Toca em <b>Partilhar</b>{" "}
            <Share className="inline size-5" aria-hidden /> no Safari
          </Step>
          <Step n={2}>
            Escolhe <b>Adicionar ao ecrã principal</b>{" "}
            <SquarePlus className="inline size-5" aria-hidden />
          </Step>
          <Step n={3}>Abre o Patudos pelo ícone e volta aqui</Step>
        </ol>
        <Notice tone="mint" icon={Mail}>
          Até lá, recebes os lembretes por email.
        </Notice>
      </div>
    );
  }

  if (state === "unsupported") {
    return (
      <div
        className="flex flex-1 flex-col gap-5"
        data-testid="notificacoes-unsupported"
      >
        <h2 className="text-titulo tracking-tight">
          Este dispositivo não suporta notificações
        </h2>
        <p className="text-corpo text-tinta-suave">
          Podes experimentar noutro telemóvel ou computador.
        </p>
        <Notice tone="mint" icon={Mail}>
          Continuas a receber os lembretes por email.
        </Notice>
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div
        className="flex flex-1 flex-col gap-5"
        data-testid="notificacoes-denied"
      >
        <div className="flex items-center gap-4">
          <span className="flex size-[60px] shrink-0 items-center justify-center rounded-full bg-aviso-fundo text-aviso-banner">
            <BellOff className="size-7" strokeWidth={2.2} aria-hidden />
          </span>
          <h2 className="text-titulo tracking-tight">
            As notificações estão desligadas
          </h2>
        </div>
        <p className="text-corpo text-tinta-suave">
          Para as voltares a ligar, é no iPhone:
        </p>
        <ol className="flex flex-col rounded-cartao border-[1.5px] border-linha bg-branco px-4 py-2">
          <Step n={1}>
            Abre as <b>Definições</b> do iPhone
          </Step>
          <Step n={2}>
            Toca em <b>Notificações</b> e depois em <b>Patudos</b>
          </Step>
          <Step n={3}>
            Liga <b>Permitir notificações</b>
          </Step>
        </ol>
        <Notice tone="mint" icon={Mail}>
          Até lá, continuas a receber os lembretes por email.
        </Notice>
        <Button type="button" onClick={refresh} className="mt-auto">
          Já liguei
        </Button>
      </div>
    );
  }

  if (state === "on") {
    return (
      <div className="flex flex-1 flex-col gap-5" data-testid="notificacoes-on">
        <div className="flex items-center gap-4">
          <span className="flex size-[60px] shrink-0 items-center justify-center rounded-full bg-feito-fundo text-feito-texto">
            <Check className="size-7" strokeWidth={3} aria-hidden />
          </span>
          <h2 className="text-titulo tracking-tight">
            Notificações ligadas neste dispositivo
          </h2>
        </div>
        <p className="text-corpo text-tinta-suave">
          Avisamos-te no dia de cada vacina, desparasitação ou medicamento. Por
          animal, podes desligar os avisos nos lembretes dele.
        </p>
        {error ? <ErrorBanner>{error}</ErrorBanner> : null}
        {message ? (
          <p role="status" className="text-etiqueta text-feito-texto">
            {message}
          </p>
        ) : null}
        <div className="mt-auto flex flex-col gap-3">
          <Button type="button" onClick={test} disabled={pending}>
            <BellRing aria-hidden />
            Enviar notificação de teste
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={disable}
            disabled={pending}
          >
            Desligar neste dispositivo
          </Button>
        </div>
      </div>
    );
  }

  // off
  return (
    <div className="flex flex-1 flex-col gap-6" data-testid="notificacoes-off">
      <div
        className="flex flex-col gap-2.5 rounded-dialogo bg-menta px-[18px] py-6"
        aria-hidden
      >
        <FakeNotification
          title="Nina · Desparasitação externa"
          body="É hoje."
        />
        <FakeNotification
          title="Pimenta · Antibiótico"
          body="Às 20:00 · ½ comprimido"
          dim
        />
      </div>
      <div className="flex flex-col gap-2">
        <h2 className="text-titulo tracking-tight">Não te esqueças de nada</h2>
        <p className="text-corpo text-tinta-suave">
          Avisamos-te no dia de cada vacina, desparasitação ou medicamento.
        </p>
      </div>
      <ul className="flex flex-col gap-3">
        <li className="flex items-center gap-3 text-corpo font-semibold">
          <Check
            className="size-5 shrink-0 text-feito"
            strokeWidth={3}
            aria-hidden
          />
          Toca na notificação e marca «Feito»
        </li>
        <li className="flex items-center gap-3 text-corpo font-semibold">
          <Users
            className="size-5 shrink-0 text-pinheiro"
            strokeWidth={2.2}
            aria-hidden
          />
          Quem cuida contigo vê que já foi feito
        </li>
      </ul>
      {error ? <ErrorBanner>{error}</ErrorBanner> : null}
      <div className="mt-auto flex flex-col gap-2">
        <Button type="button" onClick={enable} disabled={pending}>
          Ativar notificações
        </Button>
        <Link href="/perfil" className={buttonVariants({ variant: "link" })}>
          Agora não
        </Link>
      </div>
    </div>
  );
}
