import Image from "next/image";
import type { ReactNode } from "react";

/** Moldura dos ecrãs de entrada: margem de 20 px e safe area do iPhone. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-5 pt-[max(env(safe-area-inset-top),32px)] pb-[max(env(safe-area-inset-bottom),32px)]">
      {children}
    </main>
  );
}

export function Logo({ size = 96 }: { size?: number }) {
  return (
    <Image
      src="/icons/icon-192.png"
      alt="Logótipo dos Patudos"
      width={size}
      height={size}
      priority
      className="rounded-cartao"
    />
  );
}
