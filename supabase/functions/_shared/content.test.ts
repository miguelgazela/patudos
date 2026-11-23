// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  emailContent,
  emailRecipients,
  escapeHtml,
  lastTimeLine,
  pushPayload,
  whenLine,
  type ClaimedReminder,
} from "./content.ts";

const NOW = new Date("2026-12-21T10:00:00Z"); // segunda, 21/12/2026 (Lisboa = UTC no inverno)

function item(over: Partial<ClaimedReminder> = {}): ClaimedReminder {
  return {
    occurrence_id: "occ-1",
    pet_id: "pet-1",
    pet_name: "Nina",
    title: "Desparasitação externa",
    scheduled_for: "2026-12-21T09:00:00Z",
    source_type: "health_event",
    push: true,
    email: true,
    last: {
      product: "Pipeta Advantix",
      occurred_on: "2026-11-21",
      by: "Pedro",
    },
    dose: null,
    recipients: [],
    ...over,
  };
}

describe("whenLine", () => {
  it("«É hoje» com dia da semana e data", () => {
    expect(whenLine("2026-12-21T09:00:00Z", NOW)).toBe(
      "É hoje · segunda, 21/12/2026",
    );
  });
  it("atraso de um dia e de mais", () => {
    expect(whenLine("2026-12-20T20:00:00Z", NOW)).toBe(
      "Era para ontem · domingo, 20/12/2026",
    );
    expect(whenLine("2026-12-18T20:00:00Z", NOW)).toMatch(/^Em atraso · /);
  });
  it("usa a data de Lisboa (23:30 UTC de verão já é o dia seguinte)", () => {
    expect(
      whenLine("2026-07-01T23:30:00Z", new Date("2026-07-02T00:10:00Z")),
    ).toBe("É hoje · quinta, 02/07/2026");
  });
});

describe("lastTimeLine", () => {
  it("produto, data e quem registou", () => {
    expect(lastTimeLine(item())).toBe(
      "Da última vez: Pipeta Advantix, a 21/11, pelo Pedro.",
    );
  });
  it("sem produto nem nome", () => {
    expect(
      lastTimeLine(
        item({ last: { product: null, occurred_on: "2026-11-21", by: null } }),
      ),
    ).toBe("Da última vez: a 21/11.");
  });
  it("sem dose anterior", () => {
    expect(lastTimeLine(item({ last: null }))).toBeNull();
  });
});

describe("pushPayload", () => {
  it("título «Animal · O quê» e corpo com a última vez", () => {
    expect(pushPayload(item(), NOW)).toEqual({
      title: "Nina · Desparasitação externa",
      body: "É hoje. Da última vez: Pipeta Advantix.",
      tag: "ocorrencia-occ-1",
      url: "/?ocorrencia=occ-1",
      occurrenceId: "occ-1",
    });
  });
  it("sem produto: só «É hoje.»", () => {
    expect(pushPayload(item({ last: null }), NOW).body).toBe("É hoje.");
  });
  it("em atraso", () => {
    expect(
      pushPayload(
        item({ scheduled_for: "2026-12-20T09:00:00Z", last: null }),
        NOW,
      ).body,
    ).toBe("Está em atraso.");
  });
  it("medicação: hora e dose", () => {
    const p = pushPayload(
      item({
        source_type: "medication",
        title: "Antibiótico",
        scheduled_for: "2026-12-21T20:00:00Z",
        dose: "½ comprimido",
        last: null,
      }),
      NOW,
    );
    expect(p.body).toBe("Às 20:00 · ½ comprimido");
  });
  it("remove quebras de linha e controlo", () => {
    expect(pushPayload(item({ pet_name: "Ni\nna\u0000" }), NOW).title).toBe(
      "Ni na · Desparasitação externa",
    );
  });
  it("o id é codificado no URL", () => {
    expect(pushPayload(item({ occurrence_id: "a b&c" }), NOW).url).toBe(
      "/?ocorrencia=a%20b%26c",
    );
  });
});

describe("emailContent", () => {
  const e = emailContent(item(), "https://patudos.example/", NOW);
  it("assunto", () => expect(e.subject).toBe("Nina · Desparasitação externa"));
  it("tem o animal, o quê, o «É hoje» e a última vez", () => {
    expect(e.html).toContain("Nina");
    expect(e.html).toContain("Desparasitação externa");
    expect(e.html).toContain("É hoje · segunda, 21/12/2026");
    expect(e.html).toContain(
      "Da última vez: Pipeta Advantix, a 21/11, pelo Pedro.",
    );
  });
  it("botão para a ocorrência (nunca um link de login) e rodapé com preferências", () => {
    expect(e.html).toContain(
      'href="https://patudos.example/?ocorrencia=occ-1"',
    );
    expect(e.html).toContain(
      'href="https://patudos.example/animais/pet-1/lembretes"',
    );
    expect(e.html).toContain("Abrir e marcar como feito");
    expect(e.html).toContain("Mudar preferências");
    expect(e.html).not.toMatch(/entrar|login|token/i);
    expect(e.text).toContain("https://patudos.example/?ocorrencia=occ-1");
  });
  it("escapa todo o texto dos utilizadores", () => {
    const evil = emailContent(
      item({
        pet_name: "<script>alert(1)</script>",
        title: '"><img src=x onerror=alert(2)>',
        last: { product: "<b>x</b>", occurred_on: "2026-11-21", by: "A&B <i>" },
      }),
      "https://patudos.example",
      NOW,
    );
    expect(evil.html).not.toContain("<script>");
    expect(evil.html).not.toContain("<img src=x");
    expect(evil.html).not.toContain("<b>x</b>");
    expect(evil.html).not.toContain("<i>");
    expect(evil.html).toContain("&lt;script&gt;");
    expect(evil.html).toContain("A&amp;B &lt;i&gt;");
  });
  it("sem última vez, a linha não aparece", () => {
    expect(
      emailContent(item({ last: null }), "https://x.pt", NOW).html,
    ).not.toContain("Da última vez");
  });
});

describe("escapeHtml", () => {
  it("escapa os cinco caracteres", () => {
    expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
  });
});

describe("emailRecipients", () => {
  it("ignora quem não tem email e repetidos", () => {
    const r = emailRecipients(
      item({
        recipients: [
          { user_id: "1", email: "a@x.pt", name: null },
          { user_id: "2", email: null, name: null },
          { user_id: "3", email: "a@x.pt", name: null },
        ],
      }),
    );
    expect(r.map((x) => x.user_id)).toEqual(["1"]);
  });

  it("ignora quem desligou os emails de lembrete", () => {
    const r = emailRecipients(
      item({
        recipients: [
          { user_id: "1", email: "a@x.pt", name: null, reminder_emails: true },
          { user_id: "2", email: "b@x.pt", name: null, reminder_emails: false },
          { user_id: "3", email: "c@x.pt", name: null },
        ],
      }),
    );
    expect(r.map((x) => x.user_id)).toEqual(["1", "3"]);
  });
});
