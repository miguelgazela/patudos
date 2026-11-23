import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** Estado vazio: ícone em círculo Menta, frase curta e (opcional) uma ação. */
export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  as: Heading = "h2",
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  /** `h1` quando o estado ocupa o ecrã todo (erro, 404). */
  as?: "h1" | "h2";
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-10 text-center">
      <span className="flex size-24 items-center justify-center rounded-full bg-menta text-pinheiro-escuro">
        <Icon className="size-12" strokeWidth={2.2} aria-hidden />
      </span>
      <Heading className="text-seccao">{title}</Heading>
      {children ? (
        <p className="text-corpo text-tinta-suave">{children}</p>
      ) : null}
      {action}
    </div>
  );
}
