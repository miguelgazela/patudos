import "server-only";

import { getTransport, type Email } from "./transport";

/** Só se chama a partir do servidor (Server Actions / Route Handlers). */
export async function sendEmail(email: Email): Promise<void> {
  await getTransport()(email);
}
