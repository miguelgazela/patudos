"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export function BackButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="focus-visible:shadow-foco -ml-2 flex h-12 w-fit items-center gap-2 rounded-capsula px-2 text-corpo font-extrabold text-pinheiro outline-none"
    >
      <ArrowLeft className="size-6" strokeWidth={2.2} aria-hidden />
      Voltar
    </button>
  );
}
