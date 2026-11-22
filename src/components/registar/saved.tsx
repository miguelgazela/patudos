import { Check } from "lucide-react";
import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";

/** Confirmação curta dos registos rápidos, com «Registar outro» para séries (vacinas antigas). */
export function QuickSaved({
  title,
  detail,
  petId,
  onAnother,
  testId,
}: {
  title: string;
  detail: string;
  petId: string;
  onAnother: () => void;
  testId: string;
}) {
  return (
    <div className="flex flex-1 flex-col gap-5 pt-6" data-testid={testId}>
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-20 items-center justify-center rounded-full bg-feito-fundo text-feito">
          <Check className="size-10" strokeWidth={3} aria-hidden />
        </span>
        <h1 className="text-titulo tracking-tight">{title}</h1>
        <p className="text-corpo text-tinta-suave">{detail}</p>
      </div>
      <div className="mt-2 flex flex-col gap-1">
        <Button type="button" onClick={onAnother}>
          Registar outro
        </Button>
        <Link
          href={`/animais/${petId}`}
          className={buttonVariants({ variant: "link" })}
        >
          Concluir
        </Link>
      </div>
    </div>
  );
}
