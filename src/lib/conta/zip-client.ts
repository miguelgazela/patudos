import { Zip, ZipDeflate, ZipPassThrough, strToU8 } from "fflate";

import type { ExportManifest } from "./export-data";

/** Só o tipo vem do servidor; este módulo corre no browser. */
export type Manifest = ExportManifest;

export type Progress = { done: number; total: number };

export type BuiltZip = {
  blob: Blob;
  fileName: string;
  /** Ficheiros que já não existem no Storage (ficam registados no ZIP). */
  missing: string[];
};

const PARALLEL = 3;

type Fetched =
  { ok: true; data: Uint8Array } | { ok: false; reason: "missing" };

async function fetchFile(
  url: string | null,
  fetchImpl: typeof fetch,
): Promise<Fetched> {
  if (!url) return { ok: false, reason: "missing" };
  const res = await fetchImpl(url);
  // 400/404: o objeto já não existe; qualquer outro erro é falha de rede/servidor → tentar de novo.
  if (res.status === 404 || res.status === 400) {
    return { ok: false, reason: "missing" };
  }
  if (!res.ok) throw new Error(`Falha a descarregar (${res.status})`);
  return { ok: true, data: new Uint8Array(await res.arrayBuffer()) };
}

/**
 * Monta o ZIP no browser (fflate em modo streaming): os documentos já vêm comprimidos
 * (JPEG, PDF, …), por isso vão «armazenados» sem recomprimir; o texto vai comprimido.
 * `onProgress` conta os ficheiros descarregados.
 */
export async function buildZip(
  manifest: Manifest,
  opts: {
    onProgress?: (p: Progress) => void;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<BuiltZip> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const chunks: Uint8Array[] = [];
  const zip = new Zip();

  const done = new Promise<void>((resolve, reject) => {
    zip.ondata = (err, chunk, final) => {
      if (err) return reject(err);
      chunks.push(chunk);
      if (final) resolve();
    };
  });

  function addText(path: string, text: string) {
    const entry = new ZipDeflate(path, { level: 6 });
    zip.add(entry);
    entry.push(strToU8(text), true);
  }

  const total = manifest.files.length;
  const missing: string[] = [];
  opts.onProgress?.({ done: 0, total });

  try {
    addText("LEIA-ME.txt", manifest.readme);
    addText("dados.json", JSON.stringify(manifest.json, null, 2));
    for (const c of manifest.csvs) addText(c.zipPath, c.content);

    // Descarrega alguns de cada vez, mas junta-os pela ordem (o ZIP é sequencial).
    const pending: (Promise<Fetched> | undefined)[] = [];
    const start = (i: number) => {
      const p = fetchFile(manifest.files[i]?.url ?? null, fetchImpl);
      p.catch(() => undefined); // o erro sai quando chegarmos a este ficheiro
      pending[i] = p;
    };
    for (let i = 0; i < Math.min(PARALLEL, total); i++) start(i);

    for (let i = 0; i < total; i++) {
      const result = await pending[i]!;
      if (i + PARALLEL < total) start(i + PARALLEL);
      const file = manifest.files[i]!;
      if (result.ok) {
        const entry = new ZipPassThrough(file.zipPath);
        zip.add(entry);
        entry.push(result.data, true);
      } else {
        missing.push(file.zipPath);
      }
      pending[i] = undefined; // liberta a memória
      opts.onProgress?.({ done: i + 1, total });
    }

    if (missing.length) {
      addText(
        "FICHEIROS-EM-FALTA.txt",
        [
          "Estes ficheiros já não existem no Patudos e não puderam ser incluídos:",
          "",
          ...missing,
          "",
        ].join("\r\n"),
      );
    }
    zip.end();
  } catch (error) {
    zip.terminate();
    throw error;
  }

  await done;
  return {
    blob: new Blob(chunks as BlobPart[], { type: "application/zip" }),
    fileName: manifest.fileName,
    missing,
  };
}

/**
 * Entrega o ZIP. No iPhone usa a folha de partilha («Guardar em Ficheiros»), que é o que
 * funciona de forma fiável numa PWA; nos outros sítios, descarrega. Tem de ser chamada
 * a partir de um toque (a folha de partilha exige um gesto recente).
 */
export async function saveZip(
  built: Pick<BuiltZip, "blob" | "fileName">,
): Promise<"shared" | "downloaded" | "cancelled"> {
  const file = new File([built.blob], built.fileName, {
    type: "application/zip",
  });
  const isApple =
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (
    isApple &&
    typeof navigator.canShare === "function" &&
    typeof navigator.share === "function" &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({ files: [file], title: built.fileName });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return "cancelled";
      }
      // Qualquer outro erro: cai para o descarregamento normal.
    }
  }

  const url = URL.createObjectURL(built.blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = built.fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return "downloaded";
}
