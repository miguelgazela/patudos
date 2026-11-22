import { EmailForm } from "@/components/auth/email-form";
import { AuthShell, Logo } from "@/components/auth/auth-shell";
import { InstallGate } from "@/components/auth/install-gate";

export default function EntrarPage() {
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
        <EmailForm />
      </InstallGate>
    </AuthShell>
  );
}
