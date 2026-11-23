"use client";

import { Archive, FileText, Image as ImageIcon, Table } from "lucide-react";
import { useState } from "react";

import { ErrorBanner } from "@/components/auth/banner";
import { Button } from "@/components/ui/button";
import { failMessage } from "@/lib/client-action";
import {
  buildZip,
  saveZip,
  type BuiltZip,
  type Manifest,
} from "@/lib/conta/zip-client";

type State =
  | { phase: "idle" }
  | { phase: "working"; done: number; total: number; started: boolean }
  | { phase: "ready"; built: BuiltZip; note?: string }
  | { phase: "error"; message: string };

const megabytes = (bytes: number) =>
  `${(bytes / 1048576).toFixed(1).replace(".", ",")} MB`;

const CONTENT = [
  { icon: FileText, text: "dados.json com tudo o que registaste e podes ver" },
  { icon: Table, text: "Despesas, pesos e vacinas em tabelas (CSV)" },
  { icon: ImageIcon, text: "As fotos e os documentos, numa pasta por animal" },
  { icon: Archive, text: "Um LEIA-ME a explicar o que está lá dentro" },
];

/**
 * Exportar os meus dados (ecrã 35). O servidor devolve o texto e links de curta duração;
 * o ZIP monta-se aqui, porque as funções da Vercel não devolvem respostas acima de ~4,5 MB.
 */
export function ExportPanel() {
  const [state, setState] = useState<State>({ phase: "idle" });

  async function prepare() {
    setState({ phase: "working", done: 0, total: 0, started: false });
    try {
      const res = await fetch("/perfil/exportar/manifesto", {
        cache: "no-store",
      });
      if (res.status === 401) {
        setState({
          phase: "error",
          message: "A tua sessão terminou. Entra outra vez e repete.",
        });
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const manifest = (await res.json()) as Manifest;
      const built = await buildZip(manifest, {
        onProgress: ({ done, total }) =>
          setState({ phase: "working", done, total, started: true }),
      });
      setState({
        phase: "ready",
        built,
        note: built.missing.length
          ? `${built.missing.length} ficheiro${built.missing.length === 1 ? "" : "s"} já não existia${built.missing.length === 1 ? "" : "m"} e ficou registado no ZIP.`
          : undefined,
      });
    } catch {
      setState({
        phase: "error",
        message: failMessage(
          "Não conseguimos preparar o ficheiro. Tenta de novo.",
        ),
      });
    }
  }

  async function save(built: BuiltZip) {
    const result = await saveZip(built);
    if (result === "cancelled") return;
    setState({
      phase: "ready",
      built,
      note:
        result === "shared"
          ? "Escolhe «Guardar em Ficheiros» na folha de partilha."
          : "Ficheiro descarregado.",
    });
  }

  const busy = state.phase === "working";

  return (
    <div className="flex flex-col gap-5">
      <p className="text-corpo text-tinta-suave">
        Um ficheiro ZIP com os teus dados e os dos animais a que tens acesso.
        Podes guardá-lo ou levá-lo para outra app.
      </p>

      <ul className="flex flex-col gap-3 rounded-cartao border-[1.5px] border-linha bg-branco p-4">
        {CONTENT.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-center gap-3 text-etiqueta">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-menta text-pinheiro-escuro">
              <Icon className="size-5" strokeWidth={2.2} aria-hidden />
            </span>
            {text}
          </li>
        ))}
      </ul>

      {state.phase === "error" ? (
        <ErrorBanner>{state.message}</ErrorBanner>
      ) : null}

      {busy ? (
        <div className="flex flex-col gap-2" role="status" aria-live="polite">
          <div
            role="progressbar"
            aria-label="Progresso da exportação"
            aria-valuemin={0}
            aria-valuemax={Math.max(state.total, 1)}
            aria-valuenow={state.done}
            className="h-3 w-full overflow-hidden rounded-capsula bg-linha-suave"
          >
            <div
              className="h-full rounded-capsula bg-pinheiro transition-[width] duration-200"
              style={{
                width: state.started
                  ? `${state.total ? Math.round((state.done / state.total) * 100) : 100}%`
                  : "8%",
              }}
            />
          </div>
          <p className="text-etiqueta text-tinta-suave">
            {!state.started
              ? "A recolher os dados…"
              : state.total === 0
                ? "A juntar tudo…"
                : `A descarregar ficheiros: ${state.done} de ${state.total}`}
          </p>
        </div>
      ) : null}

      {state.phase === "ready" ? (
        <div
          role="status"
          className="flex flex-col gap-1 rounded-banner bg-feito-fundo p-4 text-etiqueta text-feito-texto"
        >
          <b>O ficheiro está pronto ({megabytes(state.built.blob.size)}).</b>
          <span>{state.note ?? "Toca em «Guardar ficheiro»."}</span>
        </div>
      ) : null}

      {state.phase === "ready" ? (
        <Button type="button" onClick={() => void save(state.built)}>
          Guardar ficheiro
        </Button>
      ) : (
        <Button type="button" onClick={() => void prepare()} disabled={busy}>
          {busy ? "A preparar…" : "Preparar o ficheiro"}
        </Button>
      )}
      {state.phase === "ready" ? (
        <Button type="button" variant="link" onClick={() => void prepare()}>
          Preparar de novo
        </Button>
      ) : null}
    </div>
  );
}
