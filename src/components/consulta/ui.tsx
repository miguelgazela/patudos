"use client";

import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Painel que sobe de baixo (painéis 14 e 15, resumo E13c). */
export function Sheet({
  open,
  onOpenChange,
  title,
  closeLabel = "Fechar",
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  closeLabel?: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-[var(--scrim)] transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup
          aria-label={title}
          className="fixed inset-x-0 bottom-0 z-[60] mx-auto flex max-h-[92dvh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-t-painel bg-branco px-5 pt-2.5 pb-[max(env(safe-area-inset-bottom),32px)] transition-transform duration-250 ease-out outline-none data-[ending-style]:translate-y-full data-[starting-style]:translate-y-full"
        >
          <div
            className="mx-auto h-[5px] w-11 shrink-0 rounded-capsula bg-pega"
            aria-hidden
          />
          <div className="flex items-center justify-between gap-3">
            <Dialog.Title className="text-[22px] font-extrabold tracking-tight">
              {title}
            </Dialog.Title>
            <Dialog.Close
              aria-label={closeLabel}
              className="focus-visible:shadow-foco flex size-11 shrink-0 items-center justify-center rounded-full bg-linha-suave text-tinta outline-none"
            >
              <X className="size-[22px]" strokeWidth={2.2} aria-hidden />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Diálogo de confirmação (ações irreversíveis ou perda de dados). */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  children,
  confirmLabel,
  cancelLabel,
  onConfirm,
  destructive = true,
  pending = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  destructive?: boolean;
  pending?: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[70] bg-[var(--scrim)] transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-[80] flex w-[calc(100%-48px)] max-w-sm -translate-x-1/2 -translate-y-1/2 flex-col gap-3 rounded-dialogo bg-branco p-6 outline-none">
          <Dialog.Title className="text-seccao">{title}</Dialog.Title>
          <Dialog.Description className="text-corpo text-tinta-suave">
            {children}
          </Dialog.Description>
          <div className="mt-2 flex flex-col gap-1">
            <button
              type="button"
              disabled={pending}
              onClick={onConfirm}
              className={cn(
                "focus-visible:shadow-foco h-botao rounded-capsula text-corpo font-extrabold outline-none disabled:opacity-60",
                destructive
                  ? "bg-atraso text-branco"
                  : "bg-pinheiro text-branco",
              )}
            >
              {confirmLabel}
            </button>
            <Dialog.Close
              render={<Button variant="link" type="button" />}
              disabled={pending}
            >
              {cancelLabel}
            </Dialog.Close>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Interruptor 52×32. */
export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "focus-visible:shadow-foco relative h-8 w-[52px] shrink-0 rounded-full transition-colors outline-none",
        checked ? "bg-pinheiro" : "bg-interruptor-off",
      )}
    >
      <span
        className={cn(
          "absolute top-1 left-1 size-6 rounded-full bg-branco transition-transform",
          checked && "translate-x-5",
        )}
      />
    </button>
  );
}

export const chipBase =
  "focus-visible:shadow-foco flex h-chip items-center justify-center rounded-capsula px-4 text-etiqueta font-bold outline-none";

/** Chip de escolha única (neutro; selecionado Pinheiro + branco). */
export function Chip({
  selected,
  onClick,
  children,
  className,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        chipBase,
        selected ? "bg-pinheiro text-branco" : "bg-linha-suave text-tinta",
        className,
      )}
    >
      {children}
    </button>
  );
}

export const REASONS = [
  "Vacinação",
  "Check-up",
  "Doença",
  "Urgência",
  "Controlo",
];

/** Motivo (texto curto) com chips de sugestão. */
export function ReasonField({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="reason" className="text-etiqueta">
        Motivo
      </label>
      <input
        id="reason"
        name="reason"
        value={value}
        maxLength={120}
        autoComplete="off"
        autoCapitalize="sentences"
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "reason-erro" : undefined}
        placeholder="Porque foram ao veterinário?"
        className="focus:shadow-foco h-campo w-full rounded-campo border-2 border-linha bg-branco px-4 text-corpo font-semibold text-tinta outline-none placeholder:text-placeholder focus:border-pinheiro aria-invalid:border-atraso aria-invalid:bg-atraso-campo"
      />
      {error ? (
        <p id="reason-erro" className="text-etiqueta text-atraso" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {REASONS.map((r) => (
          <Chip
            key={r}
            selected={value === r}
            onClick={() => onChange(value === r ? "" : r)}
          >
            {r}
          </Chip>
        ))}
      </div>
    </div>
  );
}

/** Veterinário / clínica com sugestões do histórico. */
export function VetField({
  value,
  onChange,
  suggestions,
}: {
  value: string;
  onChange: (v: string) => void;
  suggestions: string[];
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="vet" className="text-etiqueta">
        Veterinário / clínica
      </label>
      <input
        id="vet"
        name="vet_name"
        list="vets"
        value={value}
        maxLength={80}
        autoComplete="off"
        autoCapitalize="words"
        onChange={(e) => onChange(e.target.value)}
        className="focus:shadow-foco h-campo w-full rounded-campo border-2 border-linha bg-branco px-4 text-corpo font-semibold text-tinta outline-none placeholder:text-placeholder focus:border-pinheiro"
      />
      <datalist id="vets">
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </div>
  );
}
