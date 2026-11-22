/** Estado do ecrã «Notificações» (ecrã 24), decidido só a partir do que o browser reporta. */
export type PushState =
  | "checking"
  /** iPhone/iPad fora da app instalada: push só existe depois de «Adicionar ao ecrã principal». */
  | "install"
  | "unsupported"
  | "denied"
  | "off"
  | "on";

export type PushEnv = {
  isIOS: boolean;
  /** Aberta a partir do ícone no ecrã principal (`display-mode: standalone` / `navigator.standalone`). */
  standalone: boolean;
  /** Service worker + PushManager + Notification existem. */
  hasPushApi: boolean;
  permission: NotificationPermission | "unsupported";
  /** Este dispositivo já tem uma subscrição ativa. */
  subscribed: boolean;
};

export function pushState(env: PushEnv): PushState {
  // No iOS só a app instalada recebe push (16.4+); no separador do Safari a API nem aparece.
  if (env.isIOS && !env.standalone) return "install";
  if (!env.hasPushApi) return "unsupported";
  if (env.permission === "denied") return "denied";
  if (env.permission === "granted" && env.subscribed) return "on";
  return "off";
}

export function isIOSDevice(ua: string, maxTouchPoints: number): boolean {
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS 13+ apresenta-se como Mac.
    (/Macintosh/.test(ua) && maxTouchPoints > 1)
  );
}

/** Chave VAPID pública (base64url) → bytes, o formato que `pushManager.subscribe` pede. */
export function urlBase64ToUint8Array(b64url: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (b64url.length % 4)) % 4);
  const raw = atob((b64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
