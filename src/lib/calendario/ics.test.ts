import { describe, expect, it } from "vitest";

import { buildIcs, escapeText, foldLine, type FeedEvent } from "./ics";

const now = new Date("2026-11-22T12:00:00Z");
const opts = { appUrl: "https://patudos.example", now };

const timed: FeedEvent = {
  uid: "r1-20261128T100000Z",
  petName: "Nina",
  title: "Banho, escovar; tosquia\nem casa",
  startsAt: "2026-11-28T10:00:00Z",
  allDay: false,
  localDate: "2026-11-28",
};
const allDay: FeedEvent = {
  uid: "r2-20261231T090000Z",
  petName: "Nina",
  title: "Desparasitação externa",
  startsAt: "2026-12-31T09:00:00Z",
  allDay: true,
  localDate: "2026-12-31",
};

describe("escapeText", () => {
  it("escapa barra, ponto e vírgula, vírgula e quebras de linha", () => {
    expect(escapeText("a\\b;c,d\ne")).toBe("a\\\\b\;c\\,d\\ne");
  });
});

describe("foldLine", () => {
  it("não parte linhas curtas", () => {
    expect(foldLine("SUMMARY:Nina")).toEqual(["SUMMARY:Nina"]);
  });
  it("dobra a 75 octetos com continuação iniciada por espaço", () => {
    const parts = foldLine("X:" + "a".repeat(200));
    for (const p of parts) {
      expect(new TextEncoder().encode(p).length).toBeLessThanOrEqual(75);
    }
    expect(parts.slice(1).every((p) => p.startsWith(" "))).toBe(true);
    expect(parts.map((p, i) => (i ? p.slice(1) : p)).join("")).toBe(
      "X:" + "a".repeat(200),
    );
  });
  it("conta octetos UTF-8 e não parte caracteres", () => {
    const text = "SUMMARY:" + "ã".repeat(80);
    const parts = foldLine(text);
    for (const p of parts) {
      expect(new TextEncoder().encode(p).length).toBeLessThanOrEqual(75);
    }
    expect(parts.map((p, i) => (i ? p.slice(1) : p)).join("")).toBe(text);
  });
});

describe("buildIcs", () => {
  const ics = buildIcs([timed, allDay], opts);

  it("tem o formato mínimo válido (CRLF, VCALENDAR, eventos equilibrados)", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).not.toMatch(/[^\r]\n/);
    for (const line of ics.split("\r\n")) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
    const count = (s: string) => ics.split(s).length - 1;
    expect(count("BEGIN:VEVENT")).toBe(2);
    expect(count("END:VEVENT")).toBe(2);
    expect(count("BEGIN:VALARM")).toBe(count("END:VALARM"));
    expect(ics).toContain("X-WR-CALNAME:Patudos");
    expect(ics).toContain("X-WR-TIMEZONE:Europe/Lisbon");
    expect(ics).toContain("PRODID:");
  });

  it("evento com hora em UTC, com alarme; escapa o título", () => {
    expect(ics).toContain("UID:r1-20261128T100000Z@patudos");
    expect(ics).toContain("DTSTART:20261128T100000Z");
    expect(ics).toContain("DTEND:20261128T103000Z");
    expect(ics).toContain(
      "SUMMARY:Nina · Banho\\, escovar\; tosquia\\nem casa",
    );
    expect(ics.split("BEGIN:VALARM").length - 1).toBe(1);
  });

  it("evento de dia inteiro usa VALUE=DATE, fim no dia seguinte e sem alarme", () => {
    expect(ics).toContain("DTSTART;VALUE=DATE:20261231");
    expect(ics).toContain("DTEND;VALUE=DATE:20270101");
  });

  it("sem eventos continua a ser um calendário válido", () => {
    const empty = buildIcs([], opts);
    expect(empty).toContain("BEGIN:VCALENDAR");
    expect(empty).not.toContain("VEVENT");
  });

  it("snapshot", () => {
    expect(ics).toMatchSnapshot();
  });
});
