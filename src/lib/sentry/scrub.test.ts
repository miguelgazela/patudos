import type { ErrorEvent } from "@sentry/nextjs";
import { describe, expect, it } from "vitest";

import { scrubEvent, scrubPath, scrubText } from "./scrub";

describe("scrub", () => {
  it("tira emails e ids do texto", () => {
    expect(
      scrubText(
        "falhou para ana@exemplo.pt no animal 3f2c1a9e-1b2c-4d5e-8f90-a1b2c3d4e5f6",
      ),
    ).toBe("falhou para [email] no animal :id");
  });
  it("limpa o caminho: query, ids e token do feed", () => {
    expect(
      scrubPath(
        "https://x.pt/animais/3f2c1a9e-1b2c-4d5e-8f90-a1b2c3d4e5f6/pessoas?email=a@b.pt",
      ),
    ).toBe("/animais/:id/pessoas");
    expect(scrubPath("/api/calendario/" + "a".repeat(43) + ".ics")).toBe(
      "/api/calendario/:id",
    );
  });
  it("remove utilizador, pedido, breadcrumbs e extras", () => {
    const event = {
      type: undefined,
      user: { email: "a@b.pt", id: "1" },
      extra: { nota: "x" },
      breadcrumbs: [{ message: "clique" }],
      request: {
        url: "https://x.pt/perfil?x=1",
        method: "POST",
        cookies: { sb: "segredo" },
        data: { name: "Rita" },
        headers: { cookie: "segredo" },
      },
      exception: {
        values: [{ type: "Error", value: "erro de rita@exemplo.pt" }],
      },
    } as unknown as ErrorEvent;
    const out = scrubEvent(event);
    expect(out.user).toBeUndefined();
    expect(out.extra).toBeUndefined();
    expect(out.breadcrumbs).toBeUndefined();
    expect(out.request).toEqual({ url: "/perfil", method: "POST" });
    expect(out.exception?.values?.[0]?.value).toBe("erro de [email]");
  });
});
