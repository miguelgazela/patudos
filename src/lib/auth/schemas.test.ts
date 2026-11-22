import { describe, expect, it } from "vitest";

import { codeSchema, emailSchema, nameSchema } from "./schemas";

describe("emailSchema", () => {
  it("aceita um email válido e normaliza", () => {
    expect(emailSchema.parse("  Ana@Exemplo.PT ")).toBe("ana@exemplo.pt");
  });

  it.each(["", "   ", "ana", "ana@", "ana@exemplo"])("rejeita %j", (value) => {
    expect(emailSchema.safeParse(value).success).toBe(false);
  });

  it("dá mensagem em PT-PT", () => {
    const result = emailSchema.safeParse("ana@");
    expect(result.success ? "" : result.error.issues[0]?.message).toMatch(
      /email válido/,
    );
  });
});

describe("codeSchema", () => {
  it("aceita 6 dígitos", () => {
    expect(codeSchema.parse("012345")).toBe("012345");
  });

  it.each(["", "12345", "1234567", "12a456", "12 456"])("rejeita %j", (v) => {
    expect(codeSchema.safeParse(v).success).toBe(false);
  });
});

describe("nameSchema", () => {
  it("corta espaços", () => {
    expect(nameSchema.parse("  Pedro ")).toBe("Pedro");
  });

  it("rejeita vazio e demasiado longo", () => {
    expect(nameSchema.safeParse("   ").success).toBe(false);
    expect(nameSchema.safeParse("a".repeat(61)).success).toBe(false);
  });
});
