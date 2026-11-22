// Web Push (RFC 8030 + RFC 8291 aes128gcm + VAPID RFC 8292) só com WebCrypto e fetch.
// Corre no Deno (Edge Functions) e no Node (testes). Sem dependências.
// As chaves VAPID são as do formato `npx web-push generate-vapid-keys` (base64url).

export type PushSubscriptionKeys = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type VapidConfig = {
  /** Chave pública, base64url (65 bytes, ponto não comprimido). */
  publicKey: string;
  /** Chave privada, base64url (32 bytes). */
  privateKey: string;
  /** `mailto:...` ou URL https. */
  subject: string;
};

export type PushResult = {
  ok: boolean;
  status: number;
  /** 404/410: a subscrição morreu e deve ser apagada. */
  gone: boolean;
};

const enc = new TextEncoder();

export function b64urlDecode(s: string): Uint8Array {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

const buf = (u: Uint8Array) => u as unknown as BufferSource;

async function hkdf(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", buf(ikm), "HKDF", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: buf(salt), info: buf(info) },
    key,
    length * 8,
  );
  return new Uint8Array(bits);
}

/**
 * Cifra `plaintext` para o dispositivo (RFC 8291, um só registo).
 * `serverKeys` e `salt` só se passam nos testes (vetor do RFC).
 */
export async function encryptPayload(
  sub: Pick<PushSubscriptionKeys, "p256dh" | "auth">,
  plaintext: Uint8Array,
  opts: { serverKeys?: CryptoKeyPair; salt?: Uint8Array } = {},
): Promise<Uint8Array> {
  const uaPublic = b64urlDecode(sub.p256dh);
  const authSecret = b64urlDecode(sub.auth);
  const serverKeys =
    opts.serverKeys ??
    (await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveBits"],
    ));
  const salt = opts.salt ?? crypto.getRandomValues(new Uint8Array(16));
  const asPublic = new Uint8Array(
    await crypto.subtle.exportKey("raw", serverKeys.publicKey),
  );
  const uaKey = await crypto.subtle.importKey(
    "raw",
    buf(uaPublic),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const ecdh = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: uaKey },
      serverKeys.privateKey,
      256,
    ),
  );
  const ikm = await hkdf(
    authSecret,
    ecdh,
    concat(enc.encode("WebPush: info\0"), uaPublic, asPublic),
    32,
  );
  const cek = await hkdf(
    salt,
    ikm,
    enc.encode("Content-Encoding: aes128gcm\0"),
    16,
  );
  const nonce = await hkdf(
    salt,
    ikm,
    enc.encode("Content-Encoding: nonce\0"),
    12,
  );
  const aes = await crypto.subtle.importKey("raw", buf(cek), "AES-GCM", false, [
    "encrypt",
  ]);
  // Um só registo: dados + 0x02 (delimitador do último registo).
  const record = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: buf(nonce) },
      aes,
      buf(concat(plaintext, new Uint8Array([2]))),
    ),
  );
  const rs = new Uint8Array([0, 0, 0x10, 0]); // 4096
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, record);
}

async function importVapidPrivateKey(vapid: VapidConfig): Promise<CryptoKey> {
  const pub = b64urlDecode(vapid.publicKey);
  if (pub.length !== 65 || pub[0] !== 4) {
    throw new Error("Chave pública VAPID inválida.");
  }
  return crypto.subtle.importKey(
    "jwk",
    {
      kty: "EC",
      crv: "P-256",
      x: b64urlEncode(pub.slice(1, 33)),
      y: b64urlEncode(pub.slice(33, 65)),
      d: vapid.privateKey,
    },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
}

/** Cabeçalho `Authorization` VAPID para o serviço de push do `endpoint`. */
export async function vapidAuthorization(
  endpoint: string,
  vapid: VapidConfig,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<string> {
  const header = b64urlEncode(
    enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })),
  );
  const claims = b64urlEncode(
    enc.encode(
      JSON.stringify({
        aud: new URL(endpoint).origin,
        exp: nowSeconds + 12 * 3600,
        sub: vapid.subject,
      }),
    ),
  );
  const signingInput = `${header}.${claims}`;
  const sig = new Uint8Array(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      await importVapidPrivateKey(vapid),
      buf(enc.encode(signingInput)),
    ),
  );
  return `vapid t=${signingInput}.${b64urlEncode(sig)}, k=${vapid.publicKey}`;
}

export async function sendWebPush(
  sub: PushSubscriptionKeys,
  payload: unknown,
  vapid: VapidConfig,
  opts: { ttlSeconds?: number; fetchImpl?: typeof fetch } = {},
): Promise<PushResult> {
  const body = await encryptPayload(sub, enc.encode(JSON.stringify(payload)));
  const doFetch = opts.fetchImpl ?? fetch;
  const res = await doFetch(sub.endpoint, {
    method: "POST",
    headers: {
      Authorization: await vapidAuthorization(sub.endpoint, vapid),
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: String(opts.ttlSeconds ?? 24 * 3600),
      Urgency: "normal",
    },
    body: buf(body) as BodyInit,
  });
  // Esvazia o corpo para libertar a ligação.
  await res.text().catch(() => "");
  return {
    ok: res.status >= 200 && res.status < 300,
    status: res.status,
    gone: res.status === 404 || res.status === 410,
  };
}
