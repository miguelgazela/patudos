export type ClinicInfo = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
};

/** A clínica escolhida no ecrã: já guardada (`id`) ou nova (só o nome; é criada ao gravar). */
export type ChosenClinic = { id: string | null; name: string };

/** `tel:` com o que o telefone tem de dígitos (e +), para o iPhone abrir a chamada. */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

/**
 * Ligação `wa.me` para abrir o WhatsApp. Números portugueses de 9 dígitos (sem indicativo)
 * ganham o 351; `+` ou `00` à frente contam como indicativo já escrito. `null` se não der.
 */
export function whatsappHref(phone: string): string | null {
  let digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  else if (digits.startsWith("00")) digits = digits.slice(2);
  else if (/^[239]\d{8}$/.test(digits)) digits = `351${digits}`;
  return /^\d{8,15}$/.test(digits) ? `https://wa.me/${digits}` : null;
}

/**
 * «VetLumiar · Dra. Inês»: a clínica e, se a consulta antiga tiver, o veterinário (campo
 * antigo `vet_name`, já não editável). Sem repetidos.
 */
export function visitPlace(
  clinicName: string | null | undefined,
  legacyVetName?: string | null,
  legacyClinic?: string | null,
): string {
  const parts: string[] = [];
  for (const raw of [clinicName ?? legacyClinic, legacyVetName]) {
    const t = raw?.trim();
    if (t && !parts.some((p) => p.toLowerCase() === t.toLowerCase())) {
      parts.push(t);
    }
  }
  return parts.join(" · ");
}
