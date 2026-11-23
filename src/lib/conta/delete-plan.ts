/**
 * Plano de apagamento da conta (ecrã 35): o que acontece a cada animal.
 *  - `leave`: és cuidador, ou há outro dono → só saís; o animal fica.
 *  - `delete`: és o único dono e não há mais ninguém → é apagado.
 *  - `choose`: és o único dono e há cuidadores → passas a posse a um deles, ou o animal é apagado.
 */

export type PlanMember = {
  userId: string;
  name: string;
  role: "owner" | "caregiver";
};

export type PlanPet = {
  id: string;
  name: string;
  species: string;
  sex: string | null;
  color: string;
  photoUrl: string | null;
  /** Todos os membros do animal, incluindo quem apaga a conta. */
  members: PlanMember[];
};

export type Fate = "leave" | "delete" | "choose";

export type ClassifiedPet = PlanPet & {
  fate: Fate;
  /** Membros a quem se pode passar a posse (só em `choose`). */
  candidates: PlanMember[];
  /** Os outros membros (sem quem apaga a conta). */
  others: PlanMember[];
};

const byName = (a: PlanMember, b: PlanMember) =>
  a.name.localeCompare(b.name, "pt");

export function classifyPet(pet: PlanPet, meId: string): ClassifiedPet {
  const others = pet.members.filter((m) => m.userId !== meId).sort(byName);
  const iAmOwner = pet.members.some(
    (m) => m.userId === meId && m.role === "owner",
  );
  const otherOwner = others.some((m) => m.role === "owner");
  let fate: Fate;
  if (!iAmOwner || otherOwner) fate = "leave";
  else fate = others.length ? "choose" : "delete";
  return {
    ...pet,
    fate,
    others,
    candidates: fate === "choose" ? others : [],
  };
}

export function classifyPets(pets: PlanPet[], meId: string): ClassifiedPet[] {
  return pets.map((p) => classifyPet(p, meId));
}

/** Escolha inicial do ecrã: passar a posse ao primeiro cuidador (por ordem alfabética). */
export function defaultTransfers(
  pets: ClassifiedPet[],
): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const p of pets) {
    if (p.fate === "choose") out[p.id] = p.candidates[0]?.userId ?? null;
  }
  return out;
}

export type ResolvedPlan =
  | {
      ok: true;
      /** Posse passada a outra pessoa (o animal fica). */
      transfers: { pet: ClassifiedPet; to: PlanMember }[];
      /** Animais apagados com a conta (únicos donos, sem transferência). */
      deleted: ClassifiedPet[];
      /** Animais que ficam como estão (só se sai deles). */
      left: ClassifiedPet[];
    }
  | { ok: false; reason: "invalid_transfer" };

/**
 * Aplica as escolhas do utilizador. `transfers[petId]` é o id do novo dono, ou `null`/ausente
 * para apagar o animal. Uma transferência para quem não é candidato invalida o plano.
 */
export function resolvePlan(
  pets: ClassifiedPet[],
  transfers: Record<string, string | null | undefined>,
): ResolvedPlan {
  const known = new Set(pets.map((p) => p.id));
  for (const petId of Object.keys(transfers)) {
    if (transfers[petId] && !known.has(petId)) {
      return { ok: false, reason: "invalid_transfer" };
    }
  }

  const out = {
    transfers: [] as { pet: ClassifiedPet; to: PlanMember }[],
    deleted: [] as ClassifiedPet[],
    left: [] as ClassifiedPet[],
  };
  for (const pet of pets) {
    const to = transfers[pet.id];
    if (pet.fate === "leave") {
      // Repetição de um pedido que já passou a posse: o destinatário já é dono, nada a fazer.
      const alreadyDone = to
        ? pet.others.some((m) => m.userId === to && m.role === "owner")
        : true;
      if (!alreadyDone) return { ok: false, reason: "invalid_transfer" };
      out.left.push(pet);
    } else if (pet.fate === "delete") {
      if (to) return { ok: false, reason: "invalid_transfer" };
      out.deleted.push(pet);
    } else if (to) {
      const target = pet.candidates.find((c) => c.userId === to);
      if (!target) return { ok: false, reason: "invalid_transfer" };
      out.transfers.push({ pet, to: target });
    } else {
      out.deleted.push(pet);
    }
  }
  return { ok: true, ...out };
}
