/** Mensagens PT-PT quando a BD recusa por limite de utilização (ver migração «limites_de_utilizacao»). */
export const limitMessages = {
  pet_limit:
    "Chegaste ao limite de 30 animais ativos. Arquiva um animal para criar outro.",
  storage_pet_limit:
    "Este animal já tem 200 MB de ficheiros. Apaga documentos que já não precisas para juntar novos.",
  storage_user_limit:
    "Já usaste 1 GB de armazenamento. Apaga documentos que já não precisas para juntar novos.",
  memory_pet_limit:
    "Este tributo já tem 100 memórias. Apaga alguma para juntar outra.",
  memory: "Deixaste muitas memórias numa hora. Tenta daqui a pouco.",
  invite: "Enviaste muitos convites hoje (máximo 20 por dia). Tenta amanhã.",
  export: "Já pediste 3 exportações na última hora. Tenta daqui a pouco.",
  test_push: "Espera um minuto antes de enviar outra notificação de teste.",
} satisfies Record<string, string>;

/** Mensagem do limite atingido, se o erro da BD for um limite. */
export function limitMessage(error: {
  message?: string;
  hint?: string | null;
}): string | undefined {
  if (error.message === "rate_limited") {
    return (
      (limitMessages as Record<string, string>)[error.hint ?? ""] ??
      "Fizeste demasiados pedidos. Tenta mais tarde."
    );
  }
  return error.message
    ? (limitMessages as Record<string, string>)[error.message]
    : undefined;
}
