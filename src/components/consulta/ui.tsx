"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Check, Hospital, X } from "lucide-react";
import { useState, type ReactNode } from "react";

import { PetAvatar } from "@/components/pets/pet-avatar";
import { Button } from "@/components/ui/button";
import type { ChosenClinic, ClinicInfo } from "@/lib/clinics/clinic";
import type { FormPet } from "@/lib/vet-visits/data";
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
      // Alvo de toque de 60×44; a pista visível mantém 52×32.
      className="group/switch flex h-11 w-[60px] shrink-0 items-center justify-center rounded-full outline-none"
    >
      <span
        className={cn(
          "group-focus-visible/switch:shadow-foco relative h-8 w-[52px] rounded-full transition-colors",
          checked ? "bg-pinheiro" : "bg-interruptor-off",
        )}
      >
        <span
          className={cn(
            "absolute top-1 left-1 size-6 rounded-full bg-branco transition-transform",
            checked && "translate-x-5",
          )}
        />
      </span>
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

/**
 * Clínica da consulta: um cartão com a clínica já escolhida (a habitual do animal).
 * Tocar abre um painel com as clínicas conhecidas e «Nova clínica» (só o nome), sem sair do ecrã.
 */
export function ClinicField({
  value,
  clinics,
  onChange,
}: {
  value: ChosenClinic | null;
  clinics: ClinicInfo[];
  onChange: (c: ChosenClinic | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const known = value ? clinics.find((c) => c.id === value.id) : undefined;

  function pick(c: ChosenClinic | null) {
    onChange(c);
    setDraft("");
    setOpen(false);
  }
  function confirmNew() {
    const name = draft.trim();
    if (!name) return;
    const same = clinics.find(
      (c) => c.name.trim().toLowerCase() === name.toLowerCase(),
    );
    pick(same ? { id: same.id, name: same.name } : { id: null, name });
  }

  // A nova (ainda não gravada) também aparece na lista, já escolhida.
  const list: ChosenClinic[] = [
    ...(value && !value.id ? [value] : []),
    ...clinics.map((c) => ({ id: c.id, name: c.name })),
  ];

  return (
    <div className="flex flex-col gap-2">
      <span id="clinic-label" className="text-etiqueta">
        Clínica
      </span>
      <button
        type="button"
        data-testid="clinic-card"
        onClick={() => setOpen(true)}
        className="focus-visible:shadow-foco flex min-h-[4.5rem] w-full items-center gap-3 rounded-cartao border-[1.5px] border-linha bg-branco p-3.5 text-left outline-none"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-menta text-pinheiro-escuro">
          <Hospital className="size-5" strokeWidth={2.2} aria-hidden />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          {value ? (
            <>
              <span className="truncate text-[17px] font-bold">
                {value.name}
              </span>
              {known?.phone ? (
                <span className="truncate text-legenda text-tinta-suave">
                  {known.phone}
                </span>
              ) : null}
            </>
          ) : (
            <span className="text-[17px] font-bold text-tinta-suave">
              Escolher clínica
            </span>
          )}
        </span>
        <span className="shrink-0 text-etiqueta font-bold text-pinheiro">
          {value ? "Mudar" : "Escolher"}
        </span>
      </button>

      <Sheet open={open} onOpenChange={setOpen} title="Clínica">
        <ul className="flex flex-col" role="radiogroup" aria-label="Clínica">
          {list.map((c) => {
            const selected = value
              ? value.id === c.id && value.name === c.name
              : false;
            const info = clinics.find((x) => x.id === c.id);
            return (
              <li key={c.id ?? `new-${c.name}`}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => pick(c)}
                  className="focus-visible:shadow-foco flex min-h-16 w-full items-center gap-3 border-b-[1.5px] border-linha-suave py-2 text-left outline-none"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[17px] font-bold">
                      {c.name}
                    </span>
                    {info?.phone || info?.address ? (
                      <span className="truncate text-legenda text-tinta-suave">
                        {[info.phone, info.address].filter(Boolean).join(" · ")}
                      </span>
                    ) : !c.id ? (
                      <span className="text-legenda text-tinta-suave">
                        Nova clínica
                      </span>
                    ) : null}
                  </span>
                  {selected ? (
                    <Check
                      className="size-6 shrink-0 text-pinheiro"
                      strokeWidth={2.6}
                      aria-hidden
                    />
                  ) : null}
                </button>
              </li>
            );
          })}
          {value ? (
            <li>
              <button
                type="button"
                onClick={() => pick(null)}
                className="focus-visible:shadow-foco flex min-h-16 w-full items-center border-b-[1.5px] border-linha-suave py-2 text-left text-[17px] font-bold text-tinta-suave outline-none"
              >
                Sem clínica
              </button>
            </li>
          ) : null}
        </ul>

        <div className="flex flex-col gap-2">
          <label htmlFor="new-clinic" className="text-etiqueta">
            Nova clínica
          </label>
          <input
            id="new-clinic"
            value={draft}
            maxLength={80}
            autoComplete="off"
            autoCapitalize="words"
            placeholder="Nome da clínica"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                confirmNew();
              }
            }}
            className="focus:shadow-foco h-campo w-full rounded-campo border-2 border-linha bg-branco px-4 text-corpo font-semibold text-tinta outline-none placeholder:text-placeholder focus:border-pinheiro"
          />
          <Button
            type="button"
            variant="secondary"
            disabled={!draft.trim()}
            onClick={confirmNew}
          >
            Usar esta clínica
          </Button>
        </div>
      </Sheet>
    </div>
  );
}

/** Escolha do animal: chips com vários, só o nome com um. */
export function PetPicker({
  pets,
  value,
  onChange,
}: {
  pets: FormPet[];
  value: string;
  onChange: (id: string) => void;
}) {
  const pet = pets.find((p) => p.id === value) ?? pets[0]!;
  if (pets.length <= 1) {
    return (
      <div className="flex items-center gap-3">
        <PetAvatar
          name={pet.name}
          color={pet.color}
          photoUrl={pet.photoUrl}
          species={pet.species}
          petId={pet.id}
          ring={false}
          className="size-10 text-[16px]"
        />
        <p className="text-seccao">{pet.name}</p>
      </div>
    );
  }
  return (
    <div
      role="radiogroup"
      aria-label="Animal"
      className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1"
    >
      {pets.map((p) => {
        const on = p.id === value;
        return (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(p.id)}
            className={cn(
              "focus-visible:shadow-foco flex h-chip shrink-0 items-center gap-2 rounded-capsula pr-4 pl-1.5 text-etiqueta font-bold outline-none",
              on ? "bg-pinheiro text-branco" : "bg-linha-suave text-tinta",
            )}
          >
            <PetAvatar
              name={p.name}
              color={p.color}
              photoUrl={p.photoUrl}
              species={p.species}
              petId={p.id}
              ring={false}
              className="size-9 text-[15px]"
            />
            {p.name}
            {on ? (
              <Check className="size-4" strokeWidth={3} aria-hidden />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
