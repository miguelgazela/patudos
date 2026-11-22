// Gerador de iCalendar (RFC 5545), feito à mão: o formato é pequeno e estável, e assim não
// há dependência extra. Horas em UTC (sem VTIMEZONE); dias inteiros com VALUE=DATE.

export type FeedEvent = {
  /** Estável por lembrete + ocorrência. */
  uid: string;
  petName: string;
  title: string;
  /** ISO 8601 (UTC) do início. */
  startsAt: string;
  allDay: boolean;
  /** AAAA-MM-DD em hora de Lisboa (usado nos eventos de dia inteiro). */
  localDate: string;
};

/** Escape de TEXT: \ ; , e quebras de linha (RFC 5545, 3.3.11). */
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

const encoder = new TextEncoder();

/** Dobra a linha a 75 octetos (UTF-8), sem partir caracteres; continuação com um espaço. */
export function foldLine(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let bytes = 0;
  // A 1.ª linha tem 75 octetos; as seguintes 74 + o espaço inicial.
  let limit = 75;
  for (const ch of line) {
    const size = encoder.encode(ch).length;
    if (bytes + size > limit) {
      out.push(current);
      current = " ";
      bytes = 1;
      limit = 75;
    }
    current += ch;
    bytes += size;
  }
  out.push(current);
  return out;
}

function utcStamp(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

function dateStamp(isoDate: string): string {
  return isoDate.replaceAll("-", "");
}

function nextDay(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number) as [number, number, number];
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return next.toISOString().slice(0, 10);
}

export type IcsOptions = {
  /** Origem da app, para a ligação na descrição (ex.: https://patudos-five.vercel.app). */
  appUrl: string;
  /** «Agora» (DTSTAMP); injetável para testes. */
  now?: Date;
};

const DURATION_MINUTES = 30;

export function buildIcs(events: FeedEvent[], options: IcsOptions): string {
  const stamp = utcStamp(options.now ?? new Date());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Patudos//Calendario//PT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Patudos",
    "X-WR-TIMEZONE:Europe/Lisbon",
    // Sugestão de atualização (o Google ignora-a e demora horas; o iPhone respeita-a).
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];

  for (const e of events) {
    const summary = `${e.petName} · ${e.title}`;
    lines.push("BEGIN:VEVENT", `UID:${e.uid}@patudos`, `DTSTAMP:${stamp}`);
    if (e.allDay) {
      lines.push(
        `DTSTART;VALUE=DATE:${dateStamp(e.localDate)}`,
        `DTEND;VALUE=DATE:${dateStamp(nextDay(e.localDate))}`,
        "TRANSP:TRANSPARENT",
      );
    } else {
      const start = new Date(e.startsAt);
      const end = new Date(start.getTime() + DURATION_MINUTES * 60_000);
      lines.push(`DTSTART:${utcStamp(start)}`, `DTEND:${utcStamp(end)}`);
    }
    lines.push(
      `SUMMARY:${escapeText(summary)}`,
      `DESCRIPTION:${escapeText(`Abrir no Patudos: ${options.appUrl}`)}`,
      `URL:${options.appUrl}`,
    );
    if (!e.allDay) {
      lines.push(
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        `DESCRIPTION:${escapeText(summary)}`,
        "TRIGGER:PT0M",
        "END:VALARM",
      );
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.flatMap(foldLine).join("\r\n") + "\r\n";
}
