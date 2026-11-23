import {
  Bell,
  FileText,
  Receipt,
  Share,
  SquarePlus,
  Stethoscope,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { Logo } from "@/components/auth/auth-shell";
import { buttonVariants } from "@/components/ui/button";

const description =
  "Saúde, lembretes, despesas e documentos dos teus cães e gatos, num só sítio e partilhados com a família. Instala no iPhone e começa em minutos.";

export const metadata: Metadata = {
  title: "Patudos · a vida dos teus animais, num só sítio",
  description,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "pt_PT",
    siteName: "Patudos",
    title: "Patudos · a vida dos teus animais, num só sítio",
    description,
    images: [
      {
        url: "/apresentacao/og.png",
        width: 1200,
        height: 630,
        alt: "Ecrãs do Patudos: lembretes de hoje, ficha da Nina e despesas",
      },
    ],
  },
  twitter: { card: "summary_large_image" },
};

type Feature = {
  icon: ReactNode;
  title: string;
  text: string;
  image: string;
  alt: string;
};

const features: Feature[] = [
  {
    icon: <Bell aria-hidden strokeWidth={2.2} className="size-6" />,
    title: "Nunca mais te esqueces de uma vacina",
    text: "O Hoje mostra o que está em atraso, o que é para hoje e o que vem aí. Recebes lembretes no telemóvel ou por email, e podes ligar tudo ao teu calendário.",
    image: "hoje",
    alt: "Ecrã Hoje do Patudos com os lembretes da Nina, do Simba e da Pimenta",
  },
  {
    icon: <Stethoscope aria-hidden strokeWidth={2.2} className="size-6" />,
    title: "Uma consulta, um só registo",
    text: "Depois da ida ao veterinário, regista num único ecrã a consulta, as vacinas, a medicação, o peso, a despesa e o papel da clínica. O Patudos sugere a próxima data.",
    image: "consulta",
    alt: "Ecrã de uma consulta da Nina com vacina, medicação, peso e despesa",
  },
  {
    icon: <Receipt aria-hidden strokeWidth={2.2} className="size-6" />,
    title: "Quanto gastas, animal a animal",
    text: "Vê as despesas do mês e do ano, por animal e por tipo, sem folhas de cálculo.",
    image: "despesas",
    alt: "Ecrã de despesas do Patudos com o total do mês e por animal",
  },
  {
    icon: <FileText aria-hidden strokeWidth={2.2} className="size-6" />,
    title: "A ficha pronta para partilhar",
    text: "Vacinas, desparasitações, medicação e peso da Nina num PDF, para levares ao veterinário, ao hotel ou à pensão.",
    image: "ficha",
    alt: "Ficha da Nina, com os dados do animal e o historial de saúde",
  },
];

const steps = [
  {
    icon: <Share aria-hidden strokeWidth={2.2} className="size-6" />,
    text: "No Safari, toca no botão Partilhar.",
  },
  {
    icon: <SquarePlus aria-hidden strokeWidth={2.2} className="size-6" />,
    text: "Escolhe «Adicionar ao ecrã principal».",
  },
  {
    icon: <Logo size={24} />,
    text: "Abre os Patudos a partir do ícone. É só entrares com o teu email.",
  },
];

// Ecrã 33: página de apresentação. Pública, estática e leve. Em «/» sem sessão o proxy mostra esta página.
export default function SobrePage() {
  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-14 px-5 pt-[max(env(safe-area-inset-top),32px)] pb-12 md:gap-24 md:pt-16">
        <header className="flex flex-col items-center gap-5 text-center">
          <Logo size={88} />
          <h1 className="max-w-2xl text-[34px] leading-[1.1] font-extrabold tracking-tight md:text-[52px]">
            A vida dos teus patudos, num só sítio
          </h1>
          <p className="max-w-xl text-corpo text-tinta-suave md:text-[20px]">
            O Patudos guarda a saúde, os lembretes, as despesas e os documentos
            dos teus cães e gatos, e deixa a família cuidar deles em conjunto.
          </p>
          <Link
            href="/entrar"
            className={buttonVariants({ className: "max-w-sm" })}
          >
            Começar
          </Link>
          <p className="text-legenda text-tinta-suave">
            Entras com um código enviado por email. Sem palavra-passe.
          </p>
        </header>

        <section
          aria-labelledby="funcionalidades"
          className="flex flex-col gap-12 md:gap-20"
        >
          <h2 id="funcionalidades" className="sr-only">
            O que podes fazer
          </h2>
          {features.map((f, i) => (
            <article
              key={f.image}
              className="grid items-center gap-6 md:grid-cols-2 md:gap-14"
            >
              <div className={i % 2 ? "md:order-2" : undefined}>
                <Screenshot name={f.image} alt={f.alt} priority={i === 0} />
              </div>
              <div className="flex flex-col gap-3">
                <span className="flex size-12 items-center justify-center rounded-full bg-menta text-pinheiro-escuro">
                  {f.icon}
                </span>
                <h3 className="text-titulo tracking-tight">{f.title}</h3>
                <p className="text-corpo text-tinta-suave md:text-[19px]">
                  {f.text}
                </p>
              </div>
            </article>
          ))}
        </section>

        <section
          aria-labelledby="familia"
          className="grid items-center gap-6 rounded-painel bg-menta p-6 md:grid-cols-2 md:gap-14 md:p-12"
        >
          <div className="flex flex-col gap-3">
            <span className="flex size-12 items-center justify-center rounded-full bg-branco text-pinheiro-escuro">
              <Users aria-hidden strokeWidth={2.2} className="size-6" />
            </span>
            <h2
              id="familia"
              className="text-titulo tracking-tight text-pinheiro-escuro"
            >
              Em família, sem confusões
            </h2>
            <p className="text-corpo text-pinheiro-escuro md:text-[19px]">
              Convida quem cuida do animal por email. Cada pessoa vê o que foi
              registado e por quem, e quem convidas só vê os animais que
              partilhares. Tu decides quem fica.
            </p>
          </div>
          <Screenshot name="pessoas" alt="Ecrã de pessoas que cuidam da Nina" />
        </section>

        <section
          aria-labelledby="instalar"
          className="mx-auto flex w-full max-w-xl flex-col gap-5"
        >
          <h2 id="instalar" className="text-center text-titulo tracking-tight">
            Instala no iPhone em 3 passos
          </h2>
          <p className="text-center text-corpo text-tinta-suave">
            Os Patudos funcionam como uma app, sem passar pela App Store. Com a
            app no ecrã principal, recebes os lembretes.
          </p>
          <ol className="flex flex-col overflow-hidden rounded-cartao border-[1.5px] border-linha bg-branco">
            {steps.map((step, i) => (
              <li
                key={i}
                className="flex min-h-16 items-center gap-3 border-b-[1.5px] border-linha-suave px-4 py-3 last:border-b-0"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-menta text-pinheiro-escuro">
                  {step.icon}
                </span>
                <span className="text-corpo font-bold">
                  <span className="sr-only">Passo {i + 1}: </span>
                  {step.text}
                </span>
              </li>
            ))}
          </ol>
          <Link
            href="/entrar"
            className={buttonVariants({ className: "mx-auto max-w-sm" })}
          >
            Começar
          </Link>
        </section>
      </main>

      <footer className="border-t-[1.5px] border-linha bg-branco px-5 pt-8 pb-[max(env(safe-area-inset-bottom),32px)]">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 text-legenda text-tinta-suave md:flex-row md:items-center md:justify-between">
          <p>
            Sem publicidade, sem venda de dados e sem inteligência artificial.
          </p>
          <nav aria-label="Informação legal" className="flex gap-6">
            <Link
              href="/termos"
              className="focus-visible:shadow-foco flex min-h-11 items-center rounded-campo font-extrabold text-pinheiro underline underline-offset-4 outline-none"
            >
              Termos
            </Link>
            <Link
              href="/privacidade"
              className="focus-visible:shadow-foco flex min-h-11 items-center rounded-campo font-extrabold text-pinheiro underline underline-offset-4 outline-none"
            >
              Privacidade
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

/** Captura do ecrã real, numa moldura de telemóvel simples. */
function Screenshot({
  name,
  alt,
  priority = false,
}: {
  name: string;
  alt: string;
  priority?: boolean;
}) {
  return (
    <Image
      src={`/apresentacao/${name}.webp`}
      alt={alt}
      width={520}
      height={872}
      priority={priority}
      sizes="(min-width: 768px) 320px, 260px"
      className="mx-auto h-auto w-[260px] rounded-[36px] border-[1.5px] border-linha bg-branco shadow-[0_20px_50px_-24px_rgb(14_31_28/0.35)] md:w-[320px]"
    />
  );
}
