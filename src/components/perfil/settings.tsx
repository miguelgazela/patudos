"use client";

import { useState, useTransition } from "react";

import { Switch } from "@/components/consulta/ui";
import { PetAvatar } from "@/components/pets/pet-avatar";
import { showToast } from "@/components/ui/toast";
import { setNotify } from "@/lib/people/actions";
import { setReminderEmails } from "@/lib/perfil/actions";
import type { PetNotify } from "@/lib/perfil/data";

function useSavedSwitch(
  initial: boolean,
  save: (on: boolean) => Promise<{ ok: boolean }>,
) {
  const [on, setOn] = useState(initial);
  const [, startTransition] = useTransition();
  function change(v: boolean) {
    setOn(v);
    startTransition(async () => {
      let ok = false;
      try {
        ok = (await save(v)).ok;
      } catch {
        ok = false;
      }
      if (!ok) {
        setOn(!v);
        showToast("Não conseguimos guardar. Tenta de novo.", { tone: "erro" });
      }
    });
  }
  return [on, change] as const;
}

/** «Emails de lembrete» (sim/não). Não mexe no push nem nos lembretes por animal. */
export function ReminderEmailsSwitch({ initial }: { initial: boolean }) {
  const [on, change] = useSavedSwitch(initial, setReminderEmails);
  return <Switch checked={on} onChange={change} label="Emails de lembrete" />;
}

function PetNotifySwitch({ pet }: { pet: PetNotify }) {
  const [on, change] = useSavedSwitch(pet.notify, (v) => setNotify(pet.id, v));
  return (
    <Switch
      checked={on}
      onChange={change}
      label={`Receber lembretes de ${pet.name}`}
    />
  );
}

/** Um interruptor «Receber lembretes» por animal (`pet_members.notify`). */
export function PetNotifyList({ pets }: { pets: PetNotify[] }) {
  return (
    <ul className="overflow-hidden rounded-cartao border-[1.5px] border-linha bg-branco">
      {pets.map((pet) => (
        <li
          key={pet.id}
          className="flex min-h-16 items-center gap-3 border-b-[1.5px] border-linha-suave px-4 py-3 last:border-b-0"
        >
          <PetAvatar
            name={pet.name}
            color={pet.color}
            photoUrl={pet.photoUrl}
            species={pet.species}
            petId={pet.id}
            ring={false}
            className="size-10 text-[16px]"
          />
          <p className="min-w-0 flex-1 truncate text-corpo font-bold">
            {pet.name}
          </p>
          <PetNotifySwitch pet={pet} />
        </li>
      ))}
    </ul>
  );
}
