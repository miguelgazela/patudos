import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/** Marcador visível para o que ainda tem de ser preenchido por quem responde pelo serviço. */
export function Confirmar({ children }: { children: string }) {
  return (
    <mark className="rounded-md bg-aviso-fundo px-1.5 py-0.5 font-bold text-aviso">
      [A CONFIRMAR: {children}]
    </mark>
  );
}

/** Moldura das páginas de texto (termos, privacidade): legível no telemóvel, centrada em ecrãs largos. */
export function LegalPage({
  title,
  other,
  children,
}: {
  title: string;
  other: { href: string; label: string };
  children: ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-5 pt-[max(env(safe-area-inset-top),24px)] pb-[max(env(safe-area-inset-bottom),40px)]">
      <Link
        href="/"
        className="focus-visible:shadow-foco -ml-2 flex min-h-12 w-fit items-center gap-2 rounded-campo px-2 text-etiqueta font-extrabold text-pinheiro outline-none"
      >
        <ArrowLeft className="size-5" strokeWidth={2.4} aria-hidden />
        Patudos
      </Link>
      <h1 className="text-ecra tracking-tight">{title}</h1>
      <aside className="rounded-banner bg-aviso-fundo p-4 text-etiqueta font-bold text-aviso-banner">
        Rascunho para revisão. Este texto descreve o que a app faz de facto, mas
        ainda não foi revisto por quem responde pelo serviço. Os campos marcados{" "}
        <Confirmar>…</Confirmar> têm de ser preenchidos antes de a app abrir ao
        público.
      </aside>
      <div className="flex flex-col gap-5 text-corpo [&_a]:font-bold [&_a]:text-pinheiro [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mt-3 [&_h2]:text-seccao [&_li]:pl-1 [&_ul]:ml-5 [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-2">
        {children}
      </div>
      <Link
        href={other.href}
        className="focus-visible:shadow-foco mt-2 flex min-h-12 w-fit items-center rounded-campo text-corpo font-extrabold text-pinheiro underline underline-offset-4 outline-none"
      >
        {other.label}
      </Link>
    </main>
  );
}

export function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
