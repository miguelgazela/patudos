"use client";

import { Check, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { ErrorBanner } from "@/components/auth/banner";
import { TextField } from "@/components/auth/text-field";
import { Button } from "@/components/ui/button";
import { showToast } from "@/components/ui/toast";
import { safely } from "@/lib/client-action";
import {
  createHabitualClinic,
  setHabitualClinic,
  updateClinic,
} from "@/lib/clinics/actions";
import type { ClinicInfo } from "@/lib/clinics/clinic";

const rowClass =
  "focus-visible:shadow-foco flex min-h-16 w-full items-center gap-3 border-b-[1.5px] border-linha-suave py-2 text-left outline-none last:border-b-0";

/** Clínica habitual de um animal: editar telefone/morada, escolher outra ou criar uma nova. */
export function ClinicManager({
  petId,
  currentId,
  clinics,
}: {
  petId: string;
  currentId: string | null;
  clinics: ClinicInfo[];
}) {
  const router = useRouter();
  const current = clinics.find((c) => c.id === currentId) ?? null;
  const [d, setD] = useState({
    name: current?.name ?? "",
    phone: current?.phone ?? "",
    address: current?.address ?? "",
  });
  const [fresh, setFresh] = useState({ name: "", phone: "", address: "" });
  const [adding, setAdding] = useState(clinics.length === 0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const back = `/animais/${petId}`;

  function run(
    action: () => ReturnType<typeof setHabitualClinic>,
    done: string,
    stay = false,
  ) {
    startTransition(async () => {
      const res = await safely(action);
      if (!res.ok) {
        setErrors(res.errors ?? {});
        setMessage(res.message);
        return;
      }
      showToast(done);
      if (stay) router.refresh();
      else router.push(back);
    });
  }

  const others = clinics.filter((c) => c.id !== currentId);

  return (
    <div className="flex flex-col gap-6">
      {message ? <ErrorBanner>{message}</ErrorBanner> : null}

      {current ? (
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            setMessage(null);
            run(() => updateClinic(current.id, petId, d), "Clínica guardada");
          }}
        >
          <h2 className="text-seccao">Clínica habitual</h2>
          <TextField
            id="clinic-name"
            label="Nome"
            value={d.name}
            maxLength={80}
            onChange={(e) => setD({ ...d, name: e.target.value })}
            error={errors.name}
          />
          <TextField
            id="clinic-phone"
            label="Telefone ou telemóvel (para ligar e WhatsApp)"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            value={d.phone}
            maxLength={30}
            onChange={(e) => setD({ ...d, phone: e.target.value })}
            error={errors.phone}
          />
          <TextField
            id="clinic-address"
            label="Morada"
            autoComplete="off"
            value={d.address}
            maxLength={200}
            onChange={(e) => setD({ ...d, address: e.target.value })}
            error={errors.address}
          />
          <Button type="submit" disabled={pending}>
            {pending ? "A guardar…" : "Guardar"}
          </Button>
        </form>
      ) : (
        <p className="rounded-cartao border-[1.5px] border-dashed border-linha px-4 py-5 text-corpo text-tinta-suave">
          Ainda sem clínica habitual. Escolhe uma abaixo ou regista uma
          consulta: a primeira clínica usada fica como habitual.
        </p>
      )}

      {others.length ? (
        <section className="flex flex-col gap-1" aria-labelledby="outras">
          <h2 id="outras" className="text-seccao">
            {current ? "Mudar para outra" : "Clínicas conhecidas"}
          </h2>
          <ul>
            {others.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setMessage(null);
                    run(
                      () => setHabitualClinic(petId, c.id),
                      "Clínica habitual mudada",
                    );
                  }}
                  className={rowClass}
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[17px] font-bold">
                      {c.name}
                    </span>
                    {c.phone || c.address ? (
                      <span className="truncate text-legenda text-tinta-suave">
                        {[c.phone, c.address].filter(Boolean).join(" · ")}
                      </span>
                    ) : null}
                  </span>
                  <Check
                    className="size-6 shrink-0 text-transparent"
                    aria-hidden
                  />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {adding ? (
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            setMessage(null);
            run(() => createHabitualClinic(petId, fresh), "Clínica criada");
          }}
        >
          <h2 className="text-seccao">Nova clínica</h2>
          <TextField
            id="new-clinic-name"
            label="Nome"
            value={fresh.name}
            maxLength={80}
            autoCapitalize="words"
            onChange={(e) => setFresh({ ...fresh, name: e.target.value })}
            error={current ? undefined : errors.name}
          />
          <TextField
            id="new-clinic-phone"
            label="Telefone (opcional)"
            type="tel"
            inputMode="tel"
            value={fresh.phone}
            maxLength={30}
            onChange={(e) => setFresh({ ...fresh, phone: e.target.value })}
          />
          <Button type="submit" variant="secondary" disabled={pending}>
            Criar e usar como habitual
          </Button>
        </form>
      ) : (
        <Button
          type="button"
          variant="secondary"
          onClick={() => setAdding(true)}
        >
          <Plus aria-hidden strokeWidth={2.4} />
          Nova clínica
        </Button>
      )}
    </div>
  );
}
