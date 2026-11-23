"use client";

import { Check, TriangleAlert, X } from "lucide-react";
import { useState, useTransition, type ReactNode } from "react";

import { ErrorBanner } from "@/components/auth/banner";
import { PetAvatar } from "@/components/pets/pet-avatar";
import { Button } from "@/components/ui/button";
import { safely } from "@/lib/client-action";
import { deleteAccount } from "@/lib/conta/actions";
import {
  defaultTransfers,
  resolvePlan,
  type ClassifiedPet,
} from "@/lib/conta/delete-plan";
import { CONFIRM_WORD, isConfirmed } from "@/lib/conta/labels";
import { isPetColor } from "@/lib/pets/constants";
import { cn } from "@/lib/utils";

const DELETE = "";

const joinNames = (names: string[]) =>
  names.length <= 1
    ? (names[0] ?? "")
    : `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;

const deleted = (p: { sex: string | null }) =>
  p.sex === "female" ? "apagada" : "apagado";

/** Ecrã 35 (apagar): escolhas por animal e confirmação final escrevendo APAGAR. */
export function DeleteFlow({ pets }: { pets: ClassifiedPet[] }) {
  const [step, setStep] = useState<"choices" | "confirm">("choices");
  // petId → id do novo dono, ou "" para apagar o animal
  const [choice, setChoice] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(defaultTransfers(pets)).map(([id, to]) => [
        id,
        to ?? DELETE,
      ]),
    ),
  );
  const [typed, setTyped] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const plan = resolvePlan(
    pets,
    Object.fromEntries(Object.entries(choice).map(([k, v]) => [k, v || null])),
  );

  function submit() {
    if (!plan.ok || !isConfirmed(typed)) return;
    setMessage(null);
    startTransition(async () => {
      const res = await safely(() =>
        deleteAccount({
          transfers: Object.fromEntries(
            Object.entries(choice).map(([k, v]) => [k, v || null]),
          ),
          confirm: typed,
        }),
      );
      // Em caso de sucesso a Server Action redireciona; só voltamos aqui com erro.
      if (res && !res.ok) setMessage(res.message);
    });
  }

  if (step === "confirm" && plan.ok) {
    return (
      <form
        className="flex flex-1 flex-col gap-5 pb-40"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <span className="flex size-16 items-center justify-center rounded-full bg-atraso-fundo text-atraso">
          <TriangleAlert className="size-8" strokeWidth={2.2} aria-hidden />
        </span>
        <h2 className="text-[26px] leading-tight font-extrabold tracking-tight">
          Isto não se pode desfazer
        </h2>

        <ul className="flex flex-col gap-2.5 text-corpo font-semibold">
          {plan.transfers.map(({ pet, to }) => (
            <Line key={pet.id} kind="ok">
              {pet.name} passa para {to.name}
            </Line>
          ))}
          {plan.deleted.map((pet) => (
            <Line key={pet.id} kind="no">
              {pet.name} é {deleted(pet)} com todo o historial
              {pet.others.length
                ? `; ${joinNames(pet.others.map((o) => o.name))} perde${pet.others.length > 1 ? "m" : ""} o acesso`
                : ""}
            </Line>
          ))}
          {plan.left.map((pet) => (
            <Line key={pet.id} kind="ok">
              {pet.name} fica com as outras pessoas
            </Line>
          ))}
          <Line kind="no">A tua conta e os teus dados são apagados</Line>
        </ul>

        <div className="flex flex-col gap-2">
          <label htmlFor="confirmar" className="text-etiqueta text-tinta">
            Para confirmar, escreve {CONFIRM_WORD}
          </label>
          <input
            id="confirmar"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="done"
            className="focus:shadow-foco h-campo w-full rounded-campo border-2 border-linha bg-branco px-4 text-[20px] font-semibold tracking-[0.06em] text-tinta outline-none focus:border-atraso"
          />
        </div>

        {message ? <ErrorBanner>{message}</ErrorBanner> : null}

        <div className="fixed inset-x-0 bottom-0 z-40 border-t-[1.5px] border-linha bg-branco">
          <div className="mx-auto flex w-full max-w-md flex-col gap-1 px-5 pt-3 pb-[max(env(safe-area-inset-bottom),12px)]">
            <button
              type="submit"
              disabled={!isConfirmed(typed) || pending}
              className="focus-visible:shadow-foco h-botao w-full rounded-capsula bg-atraso text-corpo font-extrabold text-branco outline-none disabled:bg-desativado disabled:text-desativado-texto"
            >
              {pending ? "A apagar…" : "Apagar conta para sempre"}
            </button>
            <Button
              type="button"
              variant="link"
              className="w-full"
              disabled={pending}
              onClick={() => setStep("choices")}
            >
              Cancelar
            </Button>
          </div>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-corpo text-tinta-suave">
        {pets.length
          ? "Antes de apagar, vê o que acontece a cada animal. Apagamos o teu perfil e os teus dados, e isto não se pode desfazer."
          : "Apagamos o teu perfil e os teus dados. Isto não se pode desfazer."}
      </p>

      {pets.length ? (
        <ul className="flex flex-col overflow-hidden rounded-cartao border-[1.5px] border-linha bg-branco">
          {pets.map((pet) => (
            <PetRow
              key={pet.id}
              pet={pet}
              value={choice[pet.id] ?? DELETE}
              onChange={(v) => setChoice((c) => ({ ...c, [pet.id]: v }))}
            />
          ))}
        </ul>
      ) : null}

      {pets.some((p) => p.fate === "leave") ? (
        <p className="text-etiqueta text-tinta-suave">
          O que registaste nos animais que ficam continua lá, sem o teu nome
          (aparece «Conta apagada»).
        </p>
      ) : null}

      {message ? <ErrorBanner>{message}</ErrorBanner> : null}

      <Button
        type="button"
        variant="destructive"
        disabled={!plan.ok}
        onClick={() => setStep("confirm")}
      >
        Continuar
      </Button>
    </div>
  );
}

function Line({ kind, children }: { kind: "ok" | "no"; children: ReactNode }) {
  const Icon = kind === "ok" ? Check : X;
  return (
    <li className="flex items-start gap-2.5">
      <Icon
        className={cn(
          "mt-0.5 size-5 shrink-0",
          kind === "ok" ? "text-feito" : "text-atraso",
        )}
        strokeWidth={kind === "ok" ? 2.2 : 2.8}
        aria-hidden
      />
      <span>{children}</span>
    </li>
  );
}

function PetRow({
  pet,
  value,
  onChange,
}: {
  pet: ClassifiedPet;
  value: string;
  onChange: (v: string) => void;
}) {
  const others = joinNames(pet.others.map((o) => o.name));
  return (
    <li className="flex items-start gap-3 border-b-[1.5px] border-linha-suave px-4 py-3.5 last:border-b-0">
      <PetAvatar
        name={pet.name}
        color={isPetColor(pet.color) ? pet.color : "laranja"}
        photoUrl={pet.photoUrl}
        species={pet.species}
        petId={pet.id}
        ring={false}
        className="size-11"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="text-corpo font-bold">{pet.name}</p>
        {pet.fate === "choose" ? (
          <>
            <p className="text-legenda text-tinta-suave">
              Também cuidam: {others}
            </p>
            <label className="sr-only" htmlFor={`destino-${pet.id}`}>
              O que acontece a {pet.name}
            </label>
            <select
              id={`destino-${pet.id}`}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="focus:shadow-foco h-12 w-full rounded-campo border-2 border-linha bg-branco px-3 text-etiqueta font-semibold text-tinta outline-none focus:border-pinheiro"
            >
              {pet.candidates.map((c) => (
                <option key={c.userId} value={c.userId}>
                  Passar a posse para {c.name}
                </option>
              ))}
              <option value={DELETE}>Apagar {pet.name} e o historial</option>
            </select>
            {value === DELETE ? (
              <p className="text-legenda font-extrabold text-atraso">
                {pet.name} será {deleted(pet)} com o historial; {others}{" "}
                {pet.others.length > 1 ? "perdem" : "perde"} o acesso.
              </p>
            ) : null}
          </>
        ) : pet.fate === "delete" ? (
          <p className="text-legenda font-extrabold text-atraso">
            Será {deleted(pet)} com o historial
          </p>
        ) : (
          <p className="text-legenda text-tinta-suave">
            Só deixas de cuidar: {pet.name} fica com {others}
          </p>
        )}
      </div>
    </li>
  );
}
