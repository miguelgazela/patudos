"use client";

import { useEffect } from "react";

/** Regista o service worker só em produção ou em localhost seguro. */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
    const local =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";
    if (process.env.NODE_ENV !== "production" && !local) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Sem service worker a app funciona na mesma; só não instala/recebe push.
    });
  }, []);
  return null;
}
