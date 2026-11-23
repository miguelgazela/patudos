/** O que se mostra no lugar do nome quando quem registou apagou a conta (autor a `null`). */
export const DELETED_ACCOUNT = "Conta apagada";

/** Palavra que se escreve para confirmar o apagamento (ecrã 35). */
export const CONFIRM_WORD = "APAGAR";

/** Escreveu a palavra de confirmação? Ignora maiúsculas e espaços (o iPhone capitaliza). */
export function isConfirmed(input: string): boolean {
  return input.trim().toLocaleUpperCase("pt-PT") === CONFIRM_WORD;
}
