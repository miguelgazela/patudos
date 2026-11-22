"use client";

import { House, PawPrint, Plus, UserRound, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { cn } from "@/lib/utils";

import { AddSheet } from "./add-sheet";

type Tab = { href: string; label: string; icon: LucideIcon };

const left: Tab[] = [
  { href: "/", label: "Hoje", icon: House },
  { href: "/animais", label: "Animais", icon: PawPrint },
];
const right: Tab[] = [
  { href: "/despesas", label: "Despesas", icon: Wallet },
  { href: "/perfil", label: "Perfil", icon: UserRound },
];

function isActive(pathname: string, href: string) {
  return href === "/"
    ? pathname === "/"
    : pathname === href || pathname.startsWith(`${href}/`);
}

function TabLink({ tab, pathname }: { tab: Tab; pathname: string }) {
  const active = isActive(pathname, tab.href);
  const Icon = tab.icon;
  return (
    <Link
      href={tab.href}
      aria-current={active ? "page" : undefined}
      className="focus-visible:shadow-foco flex min-h-14 flex-1 flex-col items-center justify-center gap-1 outline-none"
    >
      <span
        className={cn(
          "flex h-[30px] w-14 items-center justify-center rounded-capsula",
          active ? "bg-menta text-pinheiro-escuro" : "text-tinta-suave",
        )}
      >
        <Icon className="size-6" strokeWidth={2.2} aria-hidden />
      </span>
      <span
        className={cn(
          "text-[13px] leading-none",
          active
            ? "font-extrabold text-pinheiro"
            : "font-semibold text-tinta-suave",
        )}
      >
        {tab.label}
      </span>
    </Link>
  );
}

/** Barra inferior fixa: 2 separadores, «+» Sol ao centro, 2 separadores. */
export function TabBar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-30 border-t-[1.5px] border-linha bg-branco pb-[max(env(safe-area-inset-bottom),12px)]"
      >
        <div className="mx-auto flex max-w-md items-center px-2 pt-2">
          {left.map((tab) => (
            <TabLink key={tab.href} tab={tab} pathname={pathname} />
          ))}
          <div className="flex w-20 shrink-0 justify-center">
            <button
              type="button"
              aria-label="Registar"
              aria-haspopup="dialog"
              aria-expanded={open}
              onClick={() => setOpen(true)}
              className="focus-visible:shadow-foco flex h-14 w-16 items-center justify-center rounded-[20px] bg-sol text-tinta outline-none active:translate-y-px"
            >
              <Plus className="size-7" strokeWidth={2.8} aria-hidden />
            </button>
          </div>
          {right.map((tab) => (
            <TabLink key={tab.href} tab={tab} pathname={pathname} />
          ))}
        </div>
      </nav>
      <AddSheet open={open} onOpenChange={setOpen} />
    </>
  );
}
