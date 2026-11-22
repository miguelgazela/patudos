"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const TABS = [
  { slug: "", label: "Resumo" },
  { slug: "/cronologia", label: "Cronologia" },
  { slug: "/peso", label: "Peso" },
  { slug: "/documentos", label: "Documentos" },
] as const;

/** Separadores da ficha: cada um é uma rota, para o botão «voltar» funcionar. */
export function FichaTabs({ petId }: { petId: string }) {
  const pathname = usePathname();
  const base = `/animais/${petId}`;
  return (
    <nav aria-label="Secções da ficha">
      <ul className="flex gap-1 rounded-capsula bg-linha-suave p-1">
        {TABS.map((t) => {
          const href = `${base}${t.slug}`;
          const active = pathname === href;
          return (
            <li key={t.slug} className="flex-auto">
              <Link
                href={href}
                replace
                aria-current={active ? "page" : undefined}
                className={cn(
                  "focus-visible:shadow-foco flex h-11 items-center justify-center rounded-capsula px-2 text-[13px] font-bold outline-none",
                  active
                    ? "shadow-segmento bg-branco text-pinheiro"
                    : "text-tinta-suave",
                )}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
