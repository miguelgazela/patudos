import { Wallet } from "lucide-react";

import { EmptyState } from "@/components/nav/empty-state";

export default function DespesasPage() {
  return (
    <>
      <h1 className="text-ecra tracking-tight">Despesas</h1>
      <EmptyState icon={Wallet} title="Ainda não há despesas">
        As consultas, a ração e o resto ficam todos aqui.
      </EmptyState>
    </>
  );
}
