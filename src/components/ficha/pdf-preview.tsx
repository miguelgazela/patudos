import { PetAvatar } from "@/components/pets/pet-avatar";
import type { PetColor } from "@/lib/pets/constants";
import type { PdfEventRow, PdfModel } from "@/lib/pdf/model";

function H({ children }: { children: string }) {
  return (
    <h3 className="mt-3 border-b border-linha pb-0.5 text-[11px] font-extrabold tracking-wider text-pinheiro uppercase">
      {children}
    </h3>
  );
}

function Line({ left, right }: { left: string; right?: string | null }) {
  return (
    <div className="flex justify-between gap-3 border-b border-linha-suave py-1">
      <span className="min-w-0 font-bold">{left}</span>
      {right ? (
        <span className="shrink-0 text-tinta-suave">{right}</span>
      ) : null}
    </div>
  );
}

function Events({ rows, empty }: { rows: PdfEventRow[]; empty: string }) {
  if (!rows.length) return <p className="py-1 text-tinta-suave">{empty}</p>;
  return rows.map((r, i) => (
    <Line
      key={i}
      left={[r.title, r.product].filter(Boolean).join(" · ")}
      right={r.nextDue ? `${r.date} → ${r.nextDue}` : r.date}
    />
  ));
}

/** Pré-visualização HTML da ficha (mesmo modelo de dados que o PDF). */
export function PdfPreview({
  model,
  petId,
  species,
  color,
  photoUrl,
}: {
  model: PdfModel;
  petId: string;
  species: string;
  color: PetColor;
  photoUrl: string | null;
}) {
  const { header, contacts } = model;
  return (
    <div
      role="img"
      aria-label={`Pré-visualização da ficha de ${header.name}`}
      className="rounded-[6px] bg-branco px-4 py-4 text-[11px] leading-snug text-tinta shadow-[0_2px_4px_rgba(14,31,28,.08),0_12px_30px_rgba(14,31,28,.14)]"
    >
      <div className="flex items-center gap-3 border-b-2 border-pinheiro pb-3">
        <PetAvatar
          name={header.name}
          color={color}
          photoUrl={photoUrl}
          species={species}
          petId={petId}
          className="size-14 shrink-0 text-[20px]"
        />
        <div className="min-w-0">
          <div className="text-[18px] font-extrabold">{header.name}</div>
          <div className="text-tinta-suave">{header.subtitle}</div>
          <div className="mt-0.5 text-tinta-suave">
            {header.facts.map((f) => f.value).join(" · ")}
          </div>
        </div>
      </div>

      <H>Contactos</H>
      <p>
        {contacts.vet
          ? [contacts.vet.name, contacts.vet.clinic].filter(Boolean).join(" · ")
          : "Sem veterinário registado"}
      </p>
      <p className="text-tinta-suave">
        {contacts.people.map((p) => `${p.name} (${p.role})`).join(", ")}
      </p>

      <H>Vacinas</H>
      <Events rows={model.vaccines} empty="Sem vacinas neste período." />
      <H>Desparasitações</H>
      <Events
        rows={model.dewormings}
        empty="Sem desparasitações neste período."
      />

      {model.medications ? (
        <>
          <H>Medicação ativa</H>
          {model.medications.length ? (
            model.medications.map((m, i) => (
              <Line
                key={i}
                left={[m.name, m.dose, m.frequency].filter(Boolean).join(" · ")}
                right={m.until}
              />
            ))
          ) : (
            <p className="py-1 text-tinta-suave">Sem medicação ativa.</p>
          )}
        </>
      ) : null}

      {model.weights ? (
        <>
          <H>Peso</H>
          {model.weights.rows.length ? (
            model.weights.rows
              .slice(0, 4)
              .map((w, i) => <Line key={i} left={w.value} right={w.date} />)
          ) : (
            <p className="py-1 text-tinta-suave">Sem pesos neste período.</p>
          )}
        </>
      ) : null}

      {model.visits ? (
        <>
          <H>Consultas</H>
          {model.visits.length ? (
            model.visits
              .slice(0, 4)
              .map((v, i) => (
                <Line
                  key={i}
                  left={[v.reason, v.vet].filter(Boolean).join(" · ")}
                  right={v.date}
                />
              ))
          ) : (
            <p className="py-1 text-tinta-suave">
              Sem consultas neste período.
            </p>
          )}
        </>
      ) : null}

      <p className="mt-3 text-tinta-suave">
        Gerado pelo Patudos em {model.generatedOn}
      </p>
    </div>
  );
}
