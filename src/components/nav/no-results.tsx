import { SearchX } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Button, buttonVariants } from "@/components/ui/button";

import { EmptyState } from "./empty-state";

const CLEAR = "Limpar filtros";

/**
 * Estado vazio «com filtros ou pesquisa ativos»: igual em cronologia, despesas e documentos.
 * `clearHref` (ligação) ou `onClear` (botão) repõem a lista inteira.
 */
export function NoResults({
  clearHref,
  onClear,
  children,
  testId = "sem-resultados",
}: {
  clearHref?: string;
  onClear?: () => void;
  children?: ReactNode;
  testId?: string;
}) {
  return (
    <div data-testid={testId} className="flex flex-1 flex-col">
      <EmptyState
        icon={SearchX}
        title="Nada com estes filtros"
        action={
          clearHref ? (
            <Link
              href={clearHref}
              replace
              className={buttonVariants({ variant: "secondary" })}
            >
              {CLEAR}
            </Link>
          ) : (
            <Button type="button" variant="secondary" onClick={onClear}>
              {CLEAR}
            </Button>
          )
        }
      >
        {children}
      </EmptyState>
    </div>
  );
}
