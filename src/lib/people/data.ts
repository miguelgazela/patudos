import "server-only";

import { notFound } from "next/navigation";

import { getCurrentProfile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";

import type { Role } from "./labels";

export type Person = {
  id: string;
  name: string;
  email: string;
  role: Role;
  notify: boolean;
  isMe: boolean;
};

export type PendingInvite = {
  id: string;
  email: string;
  role: Role;
  createdAt: string;
  expired: boolean;
};

export type PeopleData = {
  petId: string;
  petName: string;
  meId: string;
  isOwner: boolean;
  people: Person[];
  invites: PendingInvite[];
};

const asRole = (r: string): Role => (r === "owner" ? "owner" : "caregiver");

/** Ecrã 20. 404 se não for membro. Os convites só vêm para o dono (a RLS já o garante). */
export async function getPeople(petId: string): Promise<PeopleData> {
  const me = await getCurrentProfile();
  const supabase = await createClient();

  const { data: pet } = await supabase
    .from("pets")
    .select(
      "id, name, pet_members(user_id, role, notify, profiles(name, email))",
    )
    .eq("id", petId)
    .maybeSingle();
  if (!pet) notFound();

  const people: Person[] = pet.pet_members
    .map((m) => ({
      id: m.user_id,
      name: m.profiles?.name?.trim() || "Alguém",
      email: m.profiles?.email ?? "",
      role: asRole(m.role),
      notify: m.notify,
      isMe: m.user_id === me.id,
    }))
    .sort(
      (a, b) =>
        Number(b.role === "owner") - Number(a.role === "owner") ||
        a.name.localeCompare(b.name, "pt"),
    );
  const isOwner = people.some((p) => p.isMe && p.role === "owner");

  let invites: PendingInvite[] = [];
  if (isOwner) {
    const { data } = await supabase
      .from("pet_invites")
      .select("id, email, role, created_at, expires_at")
      .eq("pet_id", petId)
      .is("accepted_at", null)
      .is("cancelled_at", null)
      .order("created_at", { ascending: false });
    invites = (data ?? []).map((i) => ({
      id: i.id,
      email: i.email,
      role: asRole(i.role),
      createdAt: i.created_at,
      expired: new Date(i.expires_at).getTime() < Date.now(),
    }));
  }

  return {
    petId: pet.id,
    petName: pet.name,
    meId: me.id,
    isOwner,
    people,
    invites,
  };
}
