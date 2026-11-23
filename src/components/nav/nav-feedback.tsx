"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

/**
 * Feedback imediato ao tocar numa ligação interna: a ligação fica esbatida e
 * aparece uma barra no topo até o ecrã seguinte chegar. Não faz cache de nada.
 */
function Progress() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const here = `${pathname}?${search}`;
  // Ecrã de onde se tocou na ligação; enquanto for o atual, a navegação não terminou.
  const [from, setFrom] = useState<string | null>(null);
  const [prevHere, setPrevHere] = useState(here);
  // O ecrã mudou: a navegação terminou.
  if (prevHere !== here) {
    setPrevHere(here);
    setFrom(null);
  }
  const pending = from === here;

  useEffect(() => {
    document
      .querySelectorAll("a[data-pendente]")
      .forEach((a) => a.removeAttribute("data-pendente"));
  }, [pathname, search]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]");
      if (!(a instanceof HTMLAnchorElement)) return;
      if (a.target && a.target !== "_self") return;
      if (a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search)
        return;
      a.setAttribute("data-pendente", "");
      setFrom(`${location.pathname}?${location.search.replace(/^\?/, "")}`);
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return pending ? <div className="nav-progresso" aria-hidden /> : null;
}

export function NavFeedback() {
  return (
    <Suspense fallback={null}>
      <Progress />
    </Suspense>
  );
}
