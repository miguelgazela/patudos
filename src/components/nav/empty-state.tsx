import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** Estado vazio: ícone em círculo Menta, frase curta e (opcional) uma ação. */
export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-10 text-center">
      <span className="flex size-24 items-center justify-center rounded-full bg-menta text-pinheiro-escuro">
        <Icon className="size-12" strokeWidth={2.2} aria-hidden />
      </span>
      <h2 className="text-seccao">{title}</h2>
      {children ? (
        <p className="text-corpo text-tinta-suave">{children}</p>
      ) : null}
      {action}
    </div>
  );
}
