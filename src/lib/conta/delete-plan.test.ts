import { describe, expect, it } from "vitest";

import {
  classifyPet,
  classifyPets,
  defaultTransfers,
  resolvePlan,
  type PlanPet,
} from "./delete-plan";

const ME = "me";
const member = (
  userId: string,
  role: "owner" | "caregiver",
  name = userId,
) => ({
  userId,
  name,
  role,
});
const pet = (id: string, members: ReturnType<typeof member>[]): PlanPet => ({
  id,
  name: id,
  species: "dog",
  sex: null,
  color: "laranja",
  photoUrl: null,
  members,
});

describe("classifyPet", () => {
  it("único dono sem mais ninguém: apagado", () => {
    const c = classifyPet(pet("simba", [member(ME, "owner")]), ME);
    expect(c.fate).toBe("delete");
    expect(c.candidates).toEqual([]);
  });

  it("único dono com cuidadores: escolhe a quem passar a posse", () => {
    const c = classifyPet(
      pet("nina", [
        member(ME, "owner"),
        member("pai", "caregiver", "Pai"),
        member("mae", "caregiver", "Mãe"),
      ]),
      ME,
    );
    expect(c.fate).toBe("choose");
    expect(c.candidates.map((m) => m.name)).toEqual(["Mãe", "Pai"]);
  });

  it("há outro dono: só sais", () => {
    const c = classifyPet(
      pet("pimenta", [member(ME, "owner"), member("ana", "owner")]),
      ME,
    );
    expect(c.fate).toBe("leave");
    expect(c.candidates).toEqual([]);
  });

  it("cuidador: só sais", () => {
    const c = classifyPet(
      pet("mimi", [member("ana", "owner"), member(ME, "caregiver")]),
      ME,
    );
    expect(c.fate).toBe("leave");
  });
});

describe("resolvePlan", () => {
  it("repetir um pedido cuja transferência já foi feita não é erro", () => {
    const depois = classifyPets(
      [
        pet("nina", [
          member(ME, "owner"),
          member("mae", "owner", "Mãe"),
          member("pai", "caregiver", "Pai"),
        ]),
      ],
      ME,
    );
    const r = resolvePlan(depois, { nina: "mae" });
    expect(r.ok && r.left.map((p) => p.id)).toEqual(["nina"]);
    expect(resolvePlan(depois, { nina: "pai" }).ok).toBe(false);
  });

  const pets = classifyPets(
    [
      pet("nina", [
        member(ME, "owner"),
        member("mae", "caregiver", "Mãe"),
        member("pai", "caregiver", "Pai"),
      ]),
      pet("simba", [member(ME, "owner")]),
      pet("mimi", [member("ana", "owner"), member(ME, "caregiver")]),
    ],
    ME,
  );

  it("escolha inicial: primeiro cuidador por ordem alfabética", () => {
    expect(defaultTransfers(pets)).toEqual({ nina: "mae" });
  });

  it("com transferência: o animal fica, os outros seguem o destino normal", () => {
    const r = resolvePlan(pets, { nina: "pai" });
    if (!r.ok) throw new Error("plano inválido");
    expect(r.transfers.map((t) => [t.pet.id, t.to.userId])).toEqual([
      ["nina", "pai"],
    ]);
    expect(r.deleted.map((p) => p.id)).toEqual(["simba"]);
    expect(r.left.map((p) => p.id)).toEqual(["mimi"]);
  });

  it("sem transferir: o animal com cuidadores também é apagado", () => {
    const r = resolvePlan(pets, { nina: null });
    if (!r.ok) throw new Error("plano inválido");
    expect(r.deleted.map((p) => p.id)).toEqual(["nina", "simba"]);
    expect(r.transfers).toEqual([]);
  });

  it("recusa transferir para quem não é candidato ou para animais que não são teus", () => {
    expect(resolvePlan(pets, { nina: "ana" })).toEqual({
      ok: false,
      reason: "invalid_transfer",
    });
    expect(resolvePlan(pets, { simba: "mae" }).ok).toBe(false);
    expect(resolvePlan(pets, { mimi: "mae" }).ok).toBe(false);
    expect(resolvePlan(pets, { outro: "x" }).ok).toBe(false);
  });
});
