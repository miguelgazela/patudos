import { describe, expect, it } from "vitest";

import { sentAgo } from "./labels";
import { inviteSchema } from "./schemas";

describe("sentAgo", () => {
  const now = new Date("2026-11-22T12:00:00Z");
  it("hoje, ontem e há N dias", () => {
    expect(sentAgo("2026-11-22T08:00:00Z", now)).toBe("enviado hoje");
    expect(sentAgo("2026-11-21T08:00:00Z", now)).toBe("enviado ontem");
    expect(sentAgo("2026-11-19T08:00:00Z", now)).toBe("enviado há 3 dias");
  });
});

describe("inviteSchema", () => {
  it("normaliza o email e assume cuidador", () => {
    expect(inviteSchema.parse({ email: "  Mae@Exemplo.PT " })).toEqual({
      email: "mae@exemplo.pt",
      role: "caregiver",
    });
  });
  it("recusa emails inválidos", () => {
    expect(inviteSchema.safeParse({ email: "mae" }).success).toBe(false);
  });
});
