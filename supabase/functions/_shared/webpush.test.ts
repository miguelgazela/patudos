// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  b64urlDecode,
  b64urlEncode,
  encryptPayload,
  sendWebPush,
  vapidAuthorization,
} from "./webpush.ts";

// Vetor de teste do RFC 8291, Apêndice A.
const RFC = {
  plaintext: "When I grow up, I want to be a watermelon",
  asPrivate: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
  asPublic:
    "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8",
  uaPublic:
    "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
  auth: "BTBZMqHH6r4Tts7J_aSIgg",
  salt: "DGv6ra1nlYgDCS1FRnbzlw",
  body: "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN",
};

async function importServerKeys(): Promise<CryptoKeyPair> {
  const pub = b64urlDecode(RFC.asPublic);
  const jwk = {
    kty: "EC",
    crv: "P-256",
    x: b64urlEncode(pub.slice(1, 33)),
    y: b64urlEncode(pub.slice(33, 65)),
  };
  return {
    publicKey: await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "ECDH", namedCurve: "P-256" },
      true,
      [],
    ),
    privateKey: await crypto.subtle.importKey(
      "jwk",
      { ...jwk, d: RFC.asPrivate },
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveBits"],
    ),
  };
}

async function vapidKeys() {
  const kp = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const pub = new Uint8Array(
    await crypto.subtle.exportKey("raw", kp.publicKey),
  );
  const jwk = await crypto.subtle.exportKey("jwk", kp.privateKey);
  return { kp, publicKey: b64urlEncode(pub), privateKey: jwk.d as string };
}

describe("encryptPayload (RFC 8291)", () => {
  it("reproduz o vetor de teste do RFC", async () => {
    const body = await encryptPayload(
      { p256dh: RFC.uaPublic, auth: RFC.auth },
      new TextEncoder().encode(RFC.plaintext),
      { serverKeys: await importServerKeys(), salt: b64urlDecode(RFC.salt) },
    );
    expect(b64urlEncode(body)).toBe(RFC.body);
  });

  it("gera um corpo diferente de cada vez (sal e chave efémera aleatórios)", async () => {
    const sub = { p256dh: RFC.uaPublic, auth: RFC.auth };
    const a = await encryptPayload(sub, new Uint8Array([1]));
    const b = await encryptPayload(sub, new Uint8Array([1]));
    expect(b64urlEncode(a)).not.toBe(b64urlEncode(b));
  });
});

describe("VAPID", () => {
  it("assina o JWT com ES256 e o aud é a origem do endpoint", async () => {
    const v = await vapidKeys();
    const header = await vapidAuthorization(
      "https://push.example.test/send/abc",
      {
        publicKey: v.publicKey,
        privateKey: v.privateKey,
        subject: "mailto:a@b.pt",
      },
      1_000_000,
    );
    const m = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(header);
    expect(m).not.toBeNull();
    const [, h, c, sig, k] = m!;
    expect(k).toBe(v.publicKey);
    expect(JSON.parse(new TextDecoder().decode(b64urlDecode(h!)))).toEqual({
      typ: "JWT",
      alg: "ES256",
    });
    expect(JSON.parse(new TextDecoder().decode(b64urlDecode(c!)))).toEqual({
      aud: "https://push.example.test",
      exp: 1_000_000 + 12 * 3600,
      sub: "mailto:a@b.pt",
    });
    const ok = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      v.kp.publicKey,
      b64urlDecode(sig!) as unknown as BufferSource,
      new TextEncoder().encode(`${h}.${c}`),
    );
    expect(ok).toBe(true);
  });
});

describe("sendWebPush", () => {
  it("faz POST cifrado com os cabeçalhos certos e interpreta 410 como «gone»", async () => {
    const v = await vapidKeys();
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response("", { status: 410 });
    }) as unknown as typeof fetch;
    const res = await sendWebPush(
      {
        endpoint: "https://push.example.test/x",
        p256dh: RFC.uaPublic,
        auth: RFC.auth,
      },
      { title: "t" },
      {
        publicKey: v.publicKey,
        privateKey: v.privateKey,
        subject: "mailto:a@b.pt",
      },
      { fetchImpl },
    );
    expect(res).toEqual({ ok: false, status: 410, gone: true });
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers["Content-Encoding"]).toBe("aes128gcm");
    expect(headers.TTL).toBe("86400");
    expect(headers.Authorization).toMatch(/^vapid t=/);
  });

  it("201 é sucesso; 500 não é «gone»", async () => {
    const v = await vapidKeys();
    const cfg = {
      publicKey: v.publicKey,
      privateKey: v.privateKey,
      subject: "mailto:a@b.pt",
    };
    const sub = {
      endpoint: "https://push.example.test/x",
      p256dh: RFC.uaPublic,
      auth: RFC.auth,
    };
    const make = (status: number) =>
      (async () => new Response("", { status })) as unknown as typeof fetch;
    expect(await sendWebPush(sub, {}, cfg, { fetchImpl: make(201) })).toEqual({
      ok: true,
      status: 201,
      gone: false,
    });
    expect(await sendWebPush(sub, {}, cfg, { fetchImpl: make(500) })).toEqual({
      ok: false,
      status: 500,
      gone: false,
    });
  });
});
