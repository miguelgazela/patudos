"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

import { loadPlanPets, removePetFiles } from "./delete-data";
import { classifyPets, resolvePlan } from "./delete-plan";
import { isConfirmed } from "./labels";

const inputSchema = z.object({
  /** petId → id do novo dono; `null` = apagar o animal. */
  transfers: z.record(z.uuid(), z.uuid().nullable()),
  confirm: z.string().max(40),
});

export type DeleteAccountResult = { ok: false; message: string };

const GENERIC =
  "Não conseguimos apagar a conta. Nada se perdeu; tenta de novo daqui a pouco.";

/**
 * Ecrã 35: apaga a conta de quem tem sessão. Passos, todos repetíveis (idempotentes):
 *  1. passa a posse dos animais escolhidos (é o ecrã «Pessoas»: dono promove cuidador);
 *  2. apaga os ficheiros dos animais que vão desaparecer (API do Storage, sessão do dono);
 *  3. `delete_account(...)` apaga tudo na BD numa só transação, e o utilizador em `auth.users`.
 * Se um passo falhar, a conta continua ativa e repetir completa o trabalho.
 * Sem service role: tudo corre com a sessão do próprio.
 */
export async function deleteAccount(
  input: unknown,
): Promise<DeleteAccountResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: GENERIC };
  if (!isConfirmed(parsed.data.confirm)) {
    return { ok: false, message: "Escreve APAGAR para confirmar." };
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) redirect("/entrar");
  const meId = claims.claims.sub;

  const pets = classifyPets(await loadPlanPets(supabase, meId), meId);
  const plan = resolvePlan(pets, parsed.data.transfers);
  if (!plan.ok) {
    return {
      ok: false,
      message:
        "As pessoas dos teus animais mudaram entretanto. Volta atrás e confirma outra vez.",
    };
  }

  // 1. Transferências de posse
  for (const { pet, to } of plan.transfers) {
    const { data, error } = await supabase
      .from("pet_members")
      .update({ role: "owner" })
      .eq("pet_id", pet.id)
      .eq("user_id", to.userId)
      .select("user_id");
    if (error || !data?.length) {
      return {
        ok: false,
        message: `Não conseguimos passar a posse de ${pet.name}. Tenta de novo.`,
      };
    }
  }

  // 2. Ficheiros dos animais que vão ser apagados
  const doomed = plan.deleted.map((p) => p.id);
  try {
    for (const id of doomed) await removePetFiles(supabase, id);
  } catch (error) {
    console.error("Falha a apagar ficheiros da conta", error);
    return { ok: false, message: GENERIC };
  }

  // 3. Base de dados + utilizador
  const { error } = await supabase.rpc("delete_account", {
    p_pet_ids: doomed,
  });
  if (error) {
    console.error("Falha a apagar a conta", error.message);
    return {
      ok: false,
      message:
        error.message === "plan_changed"
          ? "As pessoas dos teus animais mudaram entretanto. Volta atrás e confirma outra vez."
          : GENERIC,
    };
  }

  // A conta já não existe: limpa os cookies de sessão (o pedido à API pode falhar, não importa).
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // sem sessão válida
  }
  redirect("/conta-apagada");
}
