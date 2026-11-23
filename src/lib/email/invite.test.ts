import { describe, expect, it } from "vitest";

import { inviteEmail, inviteLink } from "./invite";
import { getTransport } from "./transport";

describe("inviteLink", () => {
  it("aponta para /entrar com o email pré-preenchido", () => {
    expect(inviteLink("https://app.pt/", "mae+1@exemplo.pt")).toBe(
      "https://app.pt/entrar?email=mae%2B1%40exemplo.pt",
    );
  });
});

describe("inviteEmail", () => {
  const mail = inviteEmail({
    inviterName: "Pedro <b>",
    petName: "Nina",
    to: "mae@exemplo.pt",
    link: inviteLink("https://app.pt", "mae@exemplo.pt"),
  });

  it("tem o assunto do design e escapa HTML", () => {
    expect(mail.subject).toBe("Pedro <b> convidou-te para cuidar de Nina");
    expect(mail.html).toContain("Pedro &lt;b&gt;");
    expect(mail.html).toContain("Abrir o Patudos");
  });

  it("não tem código de login", () => {
    expect(mail.text).not.toMatch(/\b\d{6}\b/);
    expect(mail.html).not.toMatch(/token|otp/i);
  });
});

describe("inviteEmail de um animal que faleceu", () => {
  const mail = inviteEmail({
    inviterName: "Ana",
    petName: "Nero",
    to: "mae@exemplo.pt",
    link: inviteLink("https://app.pt", "mae@exemplo.pt"),
    deceased: true,
  });

  it("convida para recordar, não para cuidar", () => {
    expect(mail.subject).toBe("Ana convidou-te para recordar Nero");
    expect(mail.text).toContain("deixar as tuas memórias");
    expect(mail.text).not.toMatch(/lembretes/);
    expect(mail.html).not.toMatch(/lembretes/);
  });
});

describe("getTransport", () => {
  it("sem configuração, falha em vez de fingir que enviou", async () => {
    await expect(
      getTransport({})({ to: "a@b.pt", subject: "x", html: "x", text: "x" }),
    ).rejects.toThrow();
  });
});
