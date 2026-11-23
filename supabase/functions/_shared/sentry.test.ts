// @vitest-environment node
import { describe, expect, it } from "vitest";

import { buildEnvelope, parseDsn, scrub } from "./sentry.ts";

describe("sentry (Edge Function)", () => {
  it("lê o DSN e o URL do envelope", () => {
    expect(parseDsn("https://abc123@o1.ingest.de.sentry.io/456")).toEqual({
      key: "abc123",
      url: "https://o1.ingest.de.sentry.io/api/456/envelope/",
    });
    expect(parseDsn("lixo")).toEqual(null);
  });

  it("o envelope não leva emails nem ids", () => {
    const body = buildEnvelope(
      new Error(
        "falhou para ana@exemplo.pt no animal 3f2c1a9e-1b2c-4d5e-8f90-a1b2c3d4e5f6",
      ),
      "send-reminders",
      "production",
      "https://k@o1.ingest.de.sentry.io/1",
    );
    expect(body).not.toContain("ana@exemplo.pt");
    expect(body).not.toContain("3f2c1a9e");
    expect(body).toContain("[email]");
    expect(scrub("a@b.pt")).toBe("[email]");
  });
});
