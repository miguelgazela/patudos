import { describe, expect, it } from "vitest";

import { limitMessage } from "./limites";

describe("limitMessage", () => {
  it("traduz limites por ação", () => {
    expect(limitMessage({ message: "rate_limited", hint: "invite" })).toMatch(
      /20 por dia/,
    );
    expect(limitMessage({ message: "rate_limited", hint: "export" })).toMatch(
      /3 exportações/,
    );
  });
  it("traduz limites diretos", () => {
    expect(limitMessage({ message: "pet_limit" })).toMatch(/30 animais/);
    expect(limitMessage({ message: "storage_pet_limit" })).toMatch(/200 MB/);
  });
  it("ação desconhecida tem mensagem genérica; outros erros ficam por traduzir", () => {
    expect(limitMessage({ message: "rate_limited" })).toMatch(/demasiados/i);
    expect(limitMessage({ message: "outro erro" })).toBeUndefined();
  });
});
