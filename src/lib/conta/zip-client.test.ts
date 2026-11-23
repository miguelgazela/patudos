import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it, vi } from "vitest";

import { buildZip, type Manifest } from "./zip-client";

const manifest: Manifest = {
  fileName: "patudos-dados-23-11-2026.zip",
  json: { animais: [{ nome: "Nina" }] },
  csvs: [{ zipPath: "pesos.csv", content: "﻿Animal;Peso\r\nNina;21,5\r\n" }],
  readme: "LEIA-ME em português",
  files: [
    { zipPath: "animais/Nina/foto.webp", url: "https://s/foto" },
    { zipPath: "animais/Nina/documentos/fatura.pdf", url: "https://s/doc" },
    { zipPath: "animais/Nina/documentos/perdido.pdf", url: null },
    { zipPath: "animais/Nina/documentos/apagado.pdf", url: "https://s/gone" },
  ],
};

function fakeFetch(): typeof fetch {
  return vi.fn(async (url: string | URL | Request) => {
    const u = String(url);
    if (u.endsWith("/gone")) return new Response("nope", { status: 404 });
    return new Response(new Uint8Array([1, 2, 3, u.length]), { status: 200 });
  }) as unknown as typeof fetch;
}

describe("buildZip", () => {
  it("junta texto e ficheiros; regista o que falta e conta o progresso", async () => {
    const progress: number[] = [];
    const built = await buildZip(manifest, {
      fetchImpl: fakeFetch(),
      onProgress: (p) => progress.push(p.done),
    });
    expect(built.fileName).toBe("patudos-dados-23-11-2026.zip");
    expect(built.missing).toEqual([
      "animais/Nina/documentos/perdido.pdf",
      "animais/Nina/documentos/apagado.pdf",
    ]);
    expect(progress).toEqual([0, 1, 2, 3, 4]);

    const files = unzipSync(new Uint8Array(await built.blob.arrayBuffer()));
    expect(Object.keys(files).sort()).toEqual(
      [
        "FICHEIROS-EM-FALTA.txt",
        "LEIA-ME.txt",
        "animais/Nina/documentos/fatura.pdf",
        "animais/Nina/foto.webp",
        "dados.json",
        "pesos.csv",
      ].sort(),
    );
    expect(JSON.parse(strFromU8(files["dados.json"]!))).toEqual(manifest.json);
    expect(strFromU8(files["pesos.csv"]!)).toContain("Nina;21,5");
    expect(strFromU8(files["LEIA-ME.txt"]!)).toBe("LEIA-ME em português");
    expect(Array.from(files["animais/Nina/foto.webp"]!).slice(0, 3)).toEqual([
      1, 2, 3,
    ]);
    expect(strFromU8(files["FICHEIROS-EM-FALTA.txt"]!)).toContain(
      "perdido.pdf",
    );
  });

  it("falha de rede/servidor não gera um ZIP incompleto", async () => {
    const failing = vi.fn(
      async () => new Response("erro", { status: 500 }),
    ) as unknown as typeof fetch;
    await expect(buildZip(manifest, { fetchImpl: failing })).rejects.toThrow(
      /Falha a descarregar/,
    );
  });
});
