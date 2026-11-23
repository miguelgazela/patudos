import { PageSkeleton } from "@/components/nav/skeleton";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { CodeForm } from "@/components/auth/code-form";
import { readPendingLogin } from "@/lib/auth/pending-login";

export default function CodigoPage() {
  return (
    <AuthShell>
      <Suspense fallback={<PageSkeleton />}>
        <Code />
      </Suspense>
    </AuthShell>
  );
}

async function Code() {
  const pending = await readPendingLogin();
  if (!pending) redirect("/entrar");

  return (
    <>
      <div className="flex flex-col gap-4">
        <h1 className="text-ecra tracking-tight">Escreve o código</h1>
        <p className="text-corpo text-tinta-suave">
          Enviámos um código para{" "}
          <strong className="font-extrabold [overflow-wrap:anywhere] text-tinta">
            {pending.email}
          </strong>
          .
        </p>
      </div>
      <CodeForm email={pending.email} />
    </>
  );
}
