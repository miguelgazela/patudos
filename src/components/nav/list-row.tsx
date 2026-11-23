import { ChevronRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

const row =
  "flex min-h-16 w-full items-center gap-3 border-b-[1.5px] border-linha-suave px-4 py-3 last:border-b-0";

/** Cartão com linhas separadas (Perfil e afins). */
export function RowList({ children }: { children: ReactNode }) {
  return (
    <ul className="overflow-hidden rounded-cartao border-[1.5px] border-linha bg-branco">
      {children}
    </ul>
  );
}

function RowIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-menta text-pinheiro-escuro">
      <Icon className="size-5" strokeWidth={2.2} aria-hidden />
    </span>
  );
}

/** Linha que leva a outro ecrã: ícone Menta, título, detalhe opcional e seta. */
export function LinkRow({
  href,
  icon,
  label,
  detail,
  sub,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  /** Estado à direita ou por baixo do título (ex.: «Ligadas», um número). */
  detail?: ReactNode;
  /** Linha de estado por baixo do título (ex.: «Ligadas»). */
  sub?: ReactNode;
}) {
  return (
    <li className={row}>
      <Link
        href={href}
        className="focus-visible:shadow-foco -my-3 -ml-4 flex min-h-16 flex-1 items-center gap-3 rounded-campo py-3 pl-4 outline-none"
      >
        <RowIcon icon={icon} />
        <span className="min-w-0 flex-1">
          <span className="block text-corpo font-bold">{label}</span>
          {sub ? <span className="block">{sub}</span> : null}
        </span>
        {detail ? <span className="shrink-0">{detail}</span> : null}
      </Link>
      <ChevronRight
        className="-ml-1 size-5 shrink-0 text-tinta-suave"
        strokeWidth={2.2}
        aria-hidden
      />
    </li>
  );
}

/** Linha com um controlo à direita (interruptor). */
export function ControlRow({
  icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}) {
  return (
    <li className={row}>
      <RowIcon icon={icon} />
      <span className="min-w-0 flex-1 text-corpo font-bold">{label}</span>
      {children}
    </li>
  );
}
