"use client";

import { useEffect, useRef } from "react";

/**
 * Com `cacheComponents` o Next mantém o ecrã anterior escondido (Activity) e
 * restaura-lhe o estado ao voltar. Os efeitos são desligados quando o ecrã
 * sai de vista, por isso é aqui que se volta ao estado inicial: assim, ao
 * voltar a abrir «Registar…», aparece o formulário e não o «Guardado».
 */
export function useResetOnLeave(reset: () => void) {
  const ref = useRef(reset);
  useEffect(() => {
    ref.current = reset;
  });
  useEffect(() => () => ref.current(), []);
}
