"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { resendCode, verifyCode } from "@/lib/auth/actions";

import { ErrorBanner, FieldError } from "./banner";
import { CodeInput } from "./code-input";

const RESEND_SECONDS = 59;
type Problem = "wrong" | "expired" | "send" | "limit" | null;

function formatCountdown(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function CodeForm({ email }: { email: string }) {
  const [problem, setProblem] = useState<Problem>(null);
  const [attempt, setAttempt] = useState(0); // muda a `key` para limpar as caixas
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const [verifying, startVerify] = useTransition();
  const [resending, startResend] = useTransition();

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  function submit(code: string) {
    setProblem(null);
    startVerify(async () => {
      const result = await verifyCode(code); // em caso de sucesso redireciona
      if (result?.error) {
        setProblem(result.error);
        setAttempt((n) => n + 1);
      }
    });
  }

  function resend() {
    setProblem(null);
    startResend(async () => {
      const { ok, rateLimited } = await resendCode();
      if (ok) {
        setSecondsLeft(RESEND_SECONDS);
        setAttempt((n) => n + 1);
      } else {
        setProblem(rateLimited ? "limit" : "send");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {problem === "expired" && (
        <ErrorBanner
          action={
            <Button
              type="button"
              variant="destructive"
              size="auto"
              onClick={resend}
              disabled={resending}
            >
              Pedir novo código
            </Button>
          }
        >
          O código expirou. Pede um novo.
        </ErrorBanner>
      )}
      {problem === "limit" && (
        <ErrorBanner>
          Pediste códigos a mais em pouco tempo. Espera um minuto e tenta de
          novo.
        </ErrorBanner>
      )}
      {problem === "send" && (
        <ErrorBanner
          action={
            <Button
              type="button"
              variant="destructive"
              size="auto"
              onClick={resend}
              disabled={resending}
            >
              Tentar de novo
            </Button>
          }
        >
          Não conseguimos enviar o código. Tenta de novo.
        </ErrorBanner>
      )}

      <div className="flex flex-col gap-3">
        <CodeInput
          key={attempt}
          autoFocus
          onComplete={submit}
          disabled={verifying}
          invalid={problem === "wrong"}
          describedBy={problem === "wrong" ? "codigo-erro" : undefined}
        />
        {problem === "wrong" && (
          <FieldError id="codigo-erro">
            Código errado. Confirma os 6 números do email.
          </FieldError>
        )}
        <p
          aria-live="polite"
          className="min-h-6 text-etiqueta text-tinta-suave"
        >
          {verifying ? "A verificar…" : ""}
        </p>
      </div>

      <div className="flex flex-col items-center gap-1">
        {secondsLeft > 0 ? (
          <p className="flex h-12 items-center text-etiqueta text-tinta-suave">
            Reenviar código em {formatCountdown(secondsLeft)}
          </p>
        ) : (
          <Button
            type="button"
            variant="link"
            onClick={resend}
            disabled={resending}
          >
            Reenviar código
          </Button>
        )}
        <Link
          href="/entrar"
          className="flex h-12 items-center text-etiqueta font-extrabold text-pinheiro underline underline-offset-4"
        >
          Mudar email
        </Link>
        <span className="sr-only">Código enviado para {email}</span>
      </div>
    </div>
  );
}
