import { PawPrint } from "lucide-react";

import { EmptyState } from "@/components/nav/empty-state";

export default function AnimaisPage() {
  return (
    <>
      <h1 className="text-ecra tracking-tight">Animais</h1>
      <EmptyState icon={PawPrint} title="Ainda não tens animais">
        Quando adicionares o primeiro patudo, aparece aqui.
      </EmptyState>
    </>
  );
}
