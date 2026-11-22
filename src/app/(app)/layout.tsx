import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { TabBar } from "@/components/nav/tab-bar";
import { getCurrentProfile } from "@/lib/auth/current-profile";

/** Área autenticada: conteúdo + barra inferior fixa (com safe area). */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <NameGuard />
      </Suspense>
      {/* A barra tem ~86 px + safe area; o conteúdo nunca fica por baixo dela. */}
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 pt-[max(env(safe-area-inset-top),32px)] pb-[calc(max(env(safe-area-inset-bottom),12px)+110px)]">
        {children}
      </div>
      {/* O caminho atual só se conhece no pedido (rotas com :id). */}
      <Suspense fallback={null}>
        <TabBar />
      </Suspense>
    </>
  );
}

/** Quem ainda não escolheu o nome passa primeiro por /bem-vindo. */
async function NameGuard() {
  const profile = await getCurrentProfile();
  if (!profile.name) redirect("/bem-vindo");
  return null;
}
