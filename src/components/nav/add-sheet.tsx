"use client";

import { Dialog } from "@base-ui/react/dialog";
import { ChevronRight, X } from "lucide-react";
import Link from "next/link";
import { useRef, useState, type PointerEvent } from "react";

import { registarActions } from "@/lib/registar";
import { cn } from "@/lib/utils";

const CLOSE_DISTANCE = 90;

/** Ecrã 6: painel que sobe de baixo com as ações de registo. */
export function AddSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [dragY, setDragY] = useState(0);
  const startY = useRef<number | null>(null);

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("button")) return;
    startY.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (startY.current === null) return;
    setDragY(Math.max(0, e.clientY - startY.current));
  }
  function onPointerEnd(e: PointerEvent<HTMLDivElement>) {
    if (startY.current === null) return;
    const distance = e.clientY - startY.current;
    startY.current = null;
    setDragY(0);
    if (distance > CLOSE_DISTANCE) onOpenChange(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-[var(--scrim)] transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup
          aria-label="Menu de registo"
          style={dragY ? { transform: `translateY(${dragY}px)` } : undefined}
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 mx-auto flex w-full max-w-md flex-col rounded-t-painel bg-branco px-5 pt-2.5 pb-[max(env(safe-area-inset-bottom),40px)] outline-none",
            dragY
              ? "transition-none"
              : "transition-transform duration-250 ease-out data-[ending-style]:translate-y-full data-[starting-style]:translate-y-full",
          )}
        >
          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerEnd}
            onPointerCancel={onPointerEnd}
            className="touch-none"
          >
            <div
              className="mx-auto mb-3 h-[5px] w-11 rounded-capsula bg-pega"
              aria-hidden
            />
            <div className="mb-4 flex items-center justify-between gap-3">
              <Dialog.Title className="text-seccao">
                O que queres registar?
              </Dialog.Title>
              <Dialog.Close
                aria-label="Fechar"
                className="focus-visible:shadow-foco flex size-11 shrink-0 items-center justify-center rounded-full bg-linha-suave text-tinta outline-none"
              >
                <X className="size-6" strokeWidth={2.2} aria-hidden />
              </Dialog.Close>
            </div>
          </div>

          <ul className="flex flex-col gap-3">
            {registarActions.map(
              ({ slug, title, description, icon: Icon, featured }) => (
                <li key={slug}>
                  <Link
                    href={`/registar/${slug}`}
                    onClick={() => onOpenChange(false)}
                    aria-label={`${title}. ${description}`}
                    className={cn(
                      "focus-visible:shadow-foco flex min-h-[72px] items-center gap-4 rounded-cartao border-[1.5px] px-4 py-3 outline-none active:translate-y-px",
                      featured
                        ? "text-white border-pinheiro bg-pinheiro"
                        : "border-linha bg-branco text-tinta",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-12 shrink-0 items-center justify-center rounded-full",
                        featured
                          ? "bg-sol text-tinta"
                          : "bg-menta text-pinheiro-escuro",
                      )}
                    >
                      <Icon className="size-6" strokeWidth={2.2} aria-hidden />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-corpo font-bold">{title}</span>
                      <span
                        className={cn(
                          "text-legenda",
                          featured ? "text-white/90" : "text-tinta-suave",
                        )}
                      >
                        {description}
                      </span>
                    </span>
                    <ChevronRight
                      className="size-5 shrink-0"
                      strokeWidth={2.2}
                      aria-hidden
                    />
                  </Link>
                </li>
              ),
            )}
          </ul>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
