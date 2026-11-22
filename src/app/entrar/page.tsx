import { Suspense } from "react";

import { EmailForm } from "@/components/auth/email-form";
import { AuthShell, Logo } from "@/components/auth/auth-shell";
import { InstallGate } from "@/components/auth/install-gate";
import { emailSchema } from "@/lib/auth/schemas";

export default function EntrarPage({ searchParams }: PageProps<"/entrar">) {
  return (
    <AuthShell>
      <InstallGate>
        <div className="flex flex-col gap-4">
          <Logo />
          <h1 className="text-ecra tracking-tight">Entrar</h1>
          <p className="text-corpo text-tinta-suave">
            Vamos enviar-te um código para entrares. Não precisas de
            palavra-passe.
          </p>
        </div>
        <Suspense fallback={<EmailForm />}>
          <PrefilledEmailForm searchParams={searchParams} />
        </Suspense>
      </InstallGate>
    </AuthShell>
  );
}

/** O link do convite traz o email pré-preenchido (nunca um código). */
async function PrefilledEmailForm({
  searchParams,
}: {
  searchParams: PageProps<"/entrar">["searchParams"];
}) {
  const { email } = await searchParams;
  const parsed = emailSchema.safeParse(typeof email === "string" ? email : "");
  return <EmailForm defaultEmail={parsed.success ? parsed.data : undefined} />;
}
