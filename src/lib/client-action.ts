/** Mensagens e proteção para Server Actions chamadas do cliente (sem ligação, falha de rede, …). */

export const SAVE_FAILED =
  "Não conseguimos guardar. Os dados continuam aqui; tenta de novo.";
export const OFFLINE_SAVE_FAILED =
  "Sem ligação à internet. Os dados continuam aqui; tenta de novo quando a ligação voltar.";

/** A mensagem certa para uma gravação que falhou (sem rede, ou o texto de recurso dado). */
export function failMessage(fallback: string = SAVE_FAILED): string {
  return typeof navigator !== "undefined" && !navigator.onLine
    ? OFFLINE_SAVE_FAILED
    : fallback;
}

/**
 * Corre uma Server Action sem deixar uma falha de rede rebentar no ecrã de erro:
 * devolve `{ ok: false, message }` e o formulário fica como está.
 */
export async function safely<T extends { ok: boolean }>(
  run: () => Promise<T>,
): Promise<T | { ok: false; message: string; errors?: undefined }> {
  try {
    return await run();
  } catch {
    return { ok: false, message: failMessage() };
  }
}
