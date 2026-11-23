import { PageSkeleton } from "@/components/nav/skeleton";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { NameForm } from "@/components/auth/name-form";
import { getCurrentProfile } from "@/lib/auth/current-profile";

export default function BemVindoPage() {
  return (
    <AuthShell>
      <div className="flex flex-col gap-4">
        <h1 className="text-ecra tracking-tight">Como te chamas?</h1>
        <p className="text-corpo text-tinta-suave">
          O teu nome aparece aos outros como «registado por…».
        </p>
      </div>
      <Suspense fallback={<PageSkeleton />}>
        <Form />
      </Suspense>
    </AuthShell>
  );
}

async function Form() {
  const profile = await getCurrentProfile();
  if (profile.name) redirect("/");
  return <NameForm />;
}
