import {
  Document,
  Font,
  Image,
  Link,
  Page,
  Polyline,
  Circle,
  StyleSheet,
  Svg,
  Text,
  View,
  Line,
} from "@react-pdf/renderer";
import { readFileSync } from "node:fs";
import path from "node:path";

import { telHref } from "@/lib/clinics/clinic";
import { formatISODate } from "@/lib/dates";
import type { PetColor } from "@/lib/pets/constants";

import type { PdfEventRow, PdfModel } from "./model";

const FONT_DIR = path.join(process.cwd(), "src/lib/pdf/fonts");
const ASSET_DIR = path.join(process.cwd(), "src/lib/pdf/assets");

let fontsReady = false;
function registerFonts() {
  if (fontsReady) return;
  fontsReady = true;
  const file = (w: number) =>
    path.join(FONT_DIR, `plus-jakarta-sans-latin-${w}-normal.woff`);
  Font.register({
    family: "Jakarta",
    fonts: [
      { src: file(400), fontWeight: 400 },
      { src: file(600), fontWeight: 600 },
      { src: file(700), fontWeight: 700 },
      { src: file(800), fontWeight: 800 },
    ],
  });
  // Sem hifenização: os nomes e termos veterinários não se partem.
  Font.registerHyphenationCallback((word) => [word]);
}

// Paleta «Prado» (design/DESIGN.md).
const C = {
  pinheiro: "#0b6b5f",
  menta: "#d5eee9",
  tinta: "#0e1f1c",
  suave: "#475a56",
  linha: "#d6e0dd",
  linhaSuave: "#e6ecea",
  nevoa: "#f2f5f4",
};

const PET_RING: Record<PetColor, { ring: string; soft: string }> = {
  laranja: { ring: "#d9580f", soft: "#fde7d9" },
  azul: { ring: "#2563eb", soft: "#dee8fd" },
  uva: { ring: "#8b3fd9", soft: "#ede1fb" },
  framboesa: { ring: "#c92a6e", soft: "#f6dde8" },
  relva: { ring: "#2f8a3e", soft: "#deece0" },
  mar: { ring: "#0e7f96", soft: "#d8ebee" },
  mel: { ring: "#b07800", soft: "#f2e9d6" },
  ardosia: { ring: "#52606d", soft: "#e3e6e8" },
};

const s = StyleSheet.create({
  page: {
    fontFamily: "Jakarta",
    fontSize: 10,
    color: C.tinta,
    paddingTop: 36,
    paddingBottom: 56,
    paddingHorizontal: 40,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 6 },
  brandIcon: { width: 20, height: 20, borderRadius: 5 },
  brandName: { fontSize: 11, fontWeight: 800, color: C.pinheiro },
  brandNote: { fontSize: 9, color: C.suave },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingBottom: 14,
    borderBottomWidth: 2,
    borderBottomColor: C.pinheiro,
  },
  photoWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 3,
    overflow: "hidden",
  },
  photo: { width: "100%", height: "100%", objectFit: "cover" },
  name: { fontSize: 26, fontWeight: 800, lineHeight: 1.3 },
  subtitle: { fontSize: 11.5, color: C.suave, lineHeight: 1.3 },
  facts: { flexDirection: "row", flexWrap: "wrap", marginTop: 6, gap: 14 },
  factLabel: { fontSize: 8, color: C.suave, textTransform: "uppercase" },
  factValue: { fontSize: 10.5, fontWeight: 700 },
  section: { marginTop: 16 },
  h2: {
    fontSize: 9.5,
    fontWeight: 800,
    color: C.pinheiro,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: C.linha,
  },
  th: {
    flexDirection: "row",
    paddingVertical: 3,
    backgroundColor: C.nevoa,
  },
  thText: { fontSize: 8, fontWeight: 700, color: C.suave },
  row: {
    flexDirection: "row",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: C.linhaSuave,
  },
  cell: { paddingHorizontal: 4 },
  bold: { fontWeight: 700 },
  muted: { color: C.suave },
  empty: { color: C.suave, paddingVertical: 4, paddingHorizontal: 4 },
  contacts: { flexDirection: "row", gap: 24 },
  contactCol: { flex: 1 },
  footer: {
    position: "absolute",
    left: 40,
    right: 40,
    bottom: 24,
    height: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderTopWidth: 1,
    borderTopColor: C.linha,
  },
  pageNumber: {
    position: "absolute",
    left: 340,
    right: 40,
    bottom: 28,
    textAlign: "right",
  },
  footerText: { fontSize: 8.5, color: C.suave },
});

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={s.section}>
      <Text style={s.h2} minPresenceAhead={60}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function Empty({ children }: { children: string }) {
  return <Text style={s.empty}>{children}</Text>;
}

function EventTable({ rows }: { rows: PdfEventRow[] }) {
  return (
    <View>
      <View style={s.th} fixed={false}>
        <Text style={[s.thText, s.cell, { flex: 4 }]}>Tratamento</Text>
        <Text style={[s.thText, s.cell, { flex: 1.6 }]}>Data</Text>
        <Text style={[s.thText, s.cell, { flex: 1.6 }]}>Próxima</Text>
      </View>
      {rows.map((r, i) => (
        <View key={i} style={s.row} wrap={false}>
          <View style={[s.cell, { flex: 4 }]}>
            <Text style={s.bold}>{r.title}</Text>
            {r.product ? <Text style={s.muted}>{r.product}</Text> : null}
          </View>
          <Text style={[s.cell, { flex: 1.6 }]}>{r.date}</Text>
          <Text style={[s.cell, { flex: 1.6 }, r.nextDue ? s.bold : s.muted]}>
            {r.nextDue ?? "–"}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Gráfico de linha do peso (SVG simples). */
function WeightChart({ series }: { series: { on: string; kg: number }[] }) {
  const W = 220;
  const H = 90;
  const pad = 10;
  const times = series.map((p) => Date.parse(`${p.on}T00:00:00Z`));
  const t0 = Math.min(...times);
  const t1 = Math.max(...times);
  const kgs = series.map((p) => p.kg);
  const lo = Math.min(...kgs);
  const hi = Math.max(...kgs);
  const x = (t: number) =>
    t1 === t0 ? W / 2 : pad + ((t - t0) / (t1 - t0)) * (W - pad * 2);
  const y = (kg: number) =>
    hi === lo ? H / 2 : H - pad - ((kg - lo) / (hi - lo)) * (H - pad * 2);
  const pts = series.map((p, i) => [x(times[i]!), y(p.kg)] as const);
  const first = series[0]!;
  const last = series[series.length - 1]!;
  return (
    <View style={{ width: W }}>
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <Line
          x1={pad}
          y1={H - 2}
          x2={W - pad}
          y2={H - 2}
          stroke={C.linha}
          strokeWidth={1}
        />
        {pts.length > 1 ? (
          <Polyline
            points={pts.map(([px, py]) => `${px},${py}`).join(" ")}
            stroke={C.pinheiro}
            strokeWidth={2}
            fill="none"
          />
        ) : null}
        {pts.map(([px, py], i) => (
          <Circle key={i} cx={px} cy={py} r={3} fill={C.pinheiro} />
        ))}
      </Svg>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={[s.muted, { fontSize: 8 }]}>
          {formatISODate(first.on)}
        </Text>
        <Text style={[s.muted, { fontSize: 8 }]}>{formatISODate(last.on)}</Text>
      </View>
    </View>
  );
}

export type PdfImage = { data: Buffer; format: "png" | "jpg" };

/* eslint-disable jsx-a11y/alt-text -- <Image> do react-pdf, não é um <img> do DOM */
/** Cabeçalho + secções da ficha. */
export function FichaPdf({
  model,
  photo,
  color,
}: {
  model: PdfModel;
  photo: PdfImage;
  color: PetColor;
}) {
  registerFonts();
  const icon = readFileSync(path.join(ASSET_DIR, "icon.png"));
  const { header, contacts } = model;
  const { ring, soft } = PET_RING[color];
  const onlyVaccines = model.options.include === "vaccines";

  return (
    <Document
      title={`Ficha de ${header.name}`}
      author="Patudos"
      creator="Patudos"
      producer="Patudos"
      language="pt-PT"
    >
      <Page size="A4" style={s.page}>
        <View style={s.footer} fixed>
          <Text style={s.footerText}>
            Gerado pelo Patudos em {model.generatedOn}
          </Text>
        </View>
        <View style={s.brandRow}>
          <View style={s.brand}>
            <Image src={{ data: icon, format: "png" }} style={s.brandIcon} />
            <Text style={s.brandName}>Patudos</Text>
          </View>
          <Text style={s.brandNote}>
            {onlyVaccines ? "Vacinas e desparasitações" : "Ficha do animal"}
            {" · "}
            {model.periodLabel}
          </Text>
        </View>

        <View style={s.head}>
          <View
            style={[s.photoWrap, { borderColor: ring, backgroundColor: soft }]}
          >
            <Image src={photo} style={s.photo} />
          </View>
          <View style={{ flex: 1, flexDirection: "column" }}>
            <Text style={s.name}>{header.name}</Text>
            {header.subtitle ? (
              <Text style={s.subtitle}>{header.subtitle}</Text>
            ) : null}
            <View style={s.facts}>
              {header.facts.map((f) => (
                <View key={f.label}>
                  <Text style={s.factLabel}>{f.label}</Text>
                  <Text style={s.factValue}>{f.value}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <Section title="Contactos">
          <View style={s.contacts}>
            <View style={s.contactCol}>
              <Text style={[s.muted, { fontSize: 8 }]}>CLÍNICA</Text>
              {contacts.clinic ? (
                <>
                  <Text style={s.bold}>{contacts.clinic.name}</Text>
                  {contacts.clinic.phone ? (
                    <Link
                      src={telHref(contacts.clinic.phone)}
                      style={{ color: "inherit", textDecoration: "none" }}
                    >
                      {contacts.clinic.phone}
                    </Link>
                  ) : null}
                  {contacts.clinic.address ? (
                    <Text>{contacts.clinic.address}</Text>
                  ) : null}
                </>
              ) : (
                <Text style={s.muted}>Sem clínica registada</Text>
              )}
            </View>
            <View style={s.contactCol}>
              <Text style={[s.muted, { fontSize: 8 }]}>QUEM CUIDA</Text>
              {contacts.people.map((p, i) => (
                <Text key={i}>
                  <Text style={s.bold}>{p.name}</Text>
                  <Text style={s.muted}>{` · ${p.role}`}</Text>
                </Text>
              ))}
            </View>
          </View>
        </Section>

        <Section title="Vacinas">
          {model.vaccines.length ? (
            <EventTable rows={model.vaccines} />
          ) : (
            <Empty>Sem vacinas registadas neste período.</Empty>
          )}
        </Section>

        <Section title="Desparasitações">
          {model.dewormings.length ? (
            <EventTable rows={model.dewormings} />
          ) : (
            <Empty>Sem desparasitações registadas neste período.</Empty>
          )}
        </Section>

        {model.medications ? (
          <Section title="Medicação ativa">
            {model.medications.length ? (
              <View>
                <View style={s.th}>
                  <Text style={[s.thText, s.cell, { flex: 3 }]}>Nome</Text>
                  <Text style={[s.thText, s.cell, { flex: 2 }]}>Dose</Text>
                  <Text style={[s.thText, s.cell, { flex: 3 }]}>
                    Frequência
                  </Text>
                  <Text style={[s.thText, s.cell, { flex: 1.6 }]}>Até</Text>
                </View>
                {model.medications.map((m, i) => (
                  <View key={i} style={s.row} wrap={false}>
                    <Text style={[s.cell, s.bold, { flex: 3 }]}>{m.name}</Text>
                    <Text style={[s.cell, { flex: 2 }]}>{m.dose || "–"}</Text>
                    <Text style={[s.cell, { flex: 3 }]}>
                      {m.frequency || "–"}
                    </Text>
                    <Text style={[s.cell, { flex: 1.6 }]}>{m.until}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Empty>Sem medicação ativa.</Empty>
            )}
          </Section>
        ) : null}

        {model.weights ? (
          <Section title="Peso">
            {model.weights.rows.length ? (
              <View style={{ flexDirection: "row", gap: 24 }} wrap={false}>
                <View style={{ flex: 1 }}>
                  {model.weights.rows.map((w, i) => (
                    <View key={i} style={s.row}>
                      <Text style={[s.cell, s.bold, { flex: 1 }]}>
                        {w.value}
                      </Text>
                      <Text style={[s.cell, { flex: 1 }]}>{w.date}</Text>
                    </View>
                  ))}
                </View>
                <WeightChart series={model.weights.series} />
              </View>
            ) : (
              <Empty>Sem pesos registados neste período.</Empty>
            )}
          </Section>
        ) : null}

        {model.visits ? (
          <Section title="Consultas">
            {model.visits.length ? (
              <View>
                <View style={s.th}>
                  <Text style={[s.thText, s.cell, { flex: 1.6 }]}>Data</Text>
                  <Text style={[s.thText, s.cell, { flex: 3 }]}>Motivo</Text>
                  <Text style={[s.thText, s.cell, { flex: 3 }]}>
                    Veterinário
                  </Text>
                </View>
                {model.visits.map((v, i) => (
                  <View key={i} style={s.row} wrap={false}>
                    <Text style={[s.cell, { flex: 1.6 }]}>{v.date}</Text>
                    <Text style={[s.cell, s.bold, { flex: 3 }]}>
                      {v.reason}
                    </Text>
                    <Text style={[s.cell, { flex: 3 }]}>{v.vet || "–"}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Empty>Sem consultas registadas neste período.</Empty>
            )}
          </Section>
        ) : null}

        {model.otherEvents.length ? (
          <Section title="Outros registos de saúde">
            <EventTable rows={model.otherEvents} />
          </Section>
        ) : null}
        <Text
          style={[s.footerText, s.pageNumber]}
          fixed
          render={({ pageNumber, totalPages }) =>
            `Página ${pageNumber} de ${totalPages}`
          }
        />
      </Page>
    </Document>
  );
}

/** Imagem por defeito (PNG convertido do WebP, que o react-pdf não lê). */
export function defaultAvatarPng(species: string, id: string): PdfImage {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const kind = species === "cat" ? "cat" : "dog";
  return {
    data: readFileSync(path.join(ASSET_DIR, `${kind}-${(hash % 4) + 1}.png`)),
    format: "png",
  };
}
