"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { inviteEmail, inviteLink } from "@/lib/email/invite";
import { sendEmail } from "@/lib/email/send";
import { createClient } from "@/lib/supabase/server";

import { inviteSchema, roleSchema } from "./schemas";

const idSchema = z.uuid();

async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/entrar");
  return { supabase, userId: data.claims.sub };
}

/** Origem da app no pedido atual (para o link do email). */
async function appOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.")
      ? "http"
      : "https");
  return `${proto}://${host}`;
}

/** Envia o email do convite. Devolve `false` se falhar (o convite já está criado). */
async function deliverInvite(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  petId: string,
  email: string,
): Promise<boolean> {
  try {
    const [{ data: me }, { data: pet }] = await Promise.all([
      supabase.from("profiles").select("name").eq("id", userId).single(),
      supabase.from("pets").select("name").eq("id", petId).single(),
    ]);
    if (!pet) return false;
    const mail = inviteEmail({
      inviterName: me?.name?.trim() || "Alguém",
      petName: pet.name,
      to: email,
      link: inviteLink(await appOrigin(), email),
    });
    await sendEmail({ to: email, ...mail });
    return true;
  } catch (error) {
    console.error("Falha ao enviar o convite", error);
    return false;
  }
}

const rpcMessages: Record<string, string> = {
  already_member: "Essa pessoa já cuida deste animal.",
  forbidden: "Só o dono pode convidar pessoas.",
  invalid_email: "Escreve um email válido, por exemplo ana@exemplo.pt",
};

export type InviteState = {
  email?: string;
  role?: string;
  message?: string;
  /** Mensagem do campo email (senão é um erro geral). */
  emailError?: boolean;
};

/** Ecrã 21: cria o convite e envia o email. Segue para o ecrã 20. */
export async function invitePerson(
  petId: string,
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const raw = {
    email: String(formData.get("email") ?? ""),
    role: String(formData.get("role") ?? "caregiver"),
  };
  const parsed = inviteSchema.safeParse(raw);
  if (!parsed.success || !idSchema.safeParse(petId).success) {
    return {
      ...raw,
      message: parsed.error?.issues[0]?.message,
      emailError: true,
    };
  }

  const { supabase, userId } = await requireUser();
  const { error } = await supabase.rpc("invite_to_pet", {
    p_pet_id: petId,
    p_email: parsed.data.email,
    p_role: parsed.data.role,
  });
  if (error) {
    return {
      ...raw,
      message:
        rpcMessages[error.message] ??
        "Não conseguimos criar o convite. Tenta de novo.",
      emailError: error.message in rpcMessages && error.message !== "forbidden",
    };
  }

  const sent = await deliverInvite(supabase, userId, petId, parsed.data.email);
  revalidatePath(`/animais/${petId}/pessoas`);
  redirect(`/animais/${petId}/pessoas?convite=${sent ? "enviado" : "falhou"}`);
}

export type PeopleResult = { ok: true; emailSent?: boolean } | { ok: false };

/** «Reenviar»: renova a validade do convite pendente e volta a enviar o email. */
export async function resendInvite(
  petId: string,
  inviteId: string,
): Promise<PeopleResult> {
  if (
    !idSchema.safeParse(petId).success ||
    !idSchema.safeParse(inviteId).success
  )
    return { ok: false };
  const { supabase, userId } = await requireUser();
  const { data: invite } = await supabase
    .from("pet_invites")
    .select("email, role")
    .eq("id", inviteId)
    .eq("pet_id", petId)
    .is("accepted_at", null)
    .is("cancelled_at", null)
    .maybeSingle();
  if (!invite) return { ok: false };

  const { error } = await supabase.rpc("invite_to_pet", {
    p_pet_id: petId,
    p_email: invite.email,
    p_role: invite.role,
  });
  if (error) return { ok: false };

  const emailSent = await deliverInvite(supabase, userId, petId, invite.email);
  revalidatePath(`/animais/${petId}/pessoas`);
  return { ok: true, emailSent };
}

export async function cancelInvite(
  petId: string,
  inviteId: string,
): Promise<PeopleResult> {
  if (!idSchema.safeParse(inviteId).success) return { ok: false };
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("pet_invites")
    .update({ cancelled_at: new Date().toISOString() })
    .eq("id", inviteId)
    .is("accepted_at", null)
    .is("cancelled_at", null)
    .select("id");
  if (error || !data?.length) return { ok: false };
  revalidatePath(`/animais/${petId}/pessoas`);
  return { ok: true };
}

/** Dono muda o papel de um membro (a BD impede ficar sem dono). */
export async function changeRole(
  petId: string,
  userId: string,
  role: unknown,
): Promise<PeopleResult & { message?: string }> {
  const r = roleSchema.safeParse(role);
  if (!r.success || !idSchema.safeParse(userId).success) return { ok: false };
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("pet_members")
    .update({ role: r.data })
    .eq("pet_id", petId)
    .eq("user_id", userId)
    .select("user_id");
  if (error || !data?.length) {
    return {
      ok: false,
      message: error?.message.includes("pelo menos um dono")
        ? "O animal tem de ter pelo menos um dono."
        : "Não conseguimos mudar o papel.",
    };
  }
  revalidatePath(`/animais/${petId}/pessoas`);
  return { ok: true };
}

/** Dono remove um cuidador (ou outro dono). */
export async function removeMember(
  petId: string,
  userId: string,
): Promise<PeopleResult & { message?: string }> {
  if (!idSchema.safeParse(userId).success) return { ok: false };
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("pet_members")
    .delete()
    .eq("pet_id", petId)
    .eq("user_id", userId)
    .select("user_id");
  if (error || !data?.length) {
    return {
      ok: false,
      message: error?.message.includes("pelo menos um dono")
        ? "O animal tem de ter pelo menos um dono."
        : "Não conseguimos remover esta pessoa.",
    };
  }
  revalidatePath(`/animais/${petId}/pessoas`);
  return { ok: true };
}

/** «Deixar de cuidar»: o próprio sai do animal. */
export async function leavePet(
  petId: string,
): Promise<PeopleResult & { message?: string }> {
  const { supabase, userId } = await requireUser();
  const { data, error } = await supabase
    .from("pet_members")
    .delete()
    .eq("pet_id", petId)
    .eq("user_id", userId)
    .select("user_id");
  if (error || !data?.length) {
    return {
      ok: false,
      message: error?.message.includes("pelo menos um dono")
        ? "És o único dono. Convida outro dono antes de sair."
        : "Não conseguimos sair. Tenta de novo.",
    };
  }
  revalidatePath("/", "layout");
  redirect("/animais");
}

/** Interruptor «Receber lembretes deste animal» (só o próprio). */
export async function setNotify(
  petId: string,
  notify: boolean,
): Promise<PeopleResult> {
  const { supabase, userId } = await requireUser();
  const { data, error } = await supabase
    .from("pet_members")
    .update({ notify })
    .eq("pet_id", petId)
    .eq("user_id", userId)
    .select("user_id");
  if (error || !data?.length) return { ok: false };
  revalidatePath(`/animais/${petId}/pessoas`);
  return { ok: true };
}
