import { X } from "lucide-react";
import Link from "next/link";

export function FormHeader({
  title,
  href = "/animais",
}: {
  title: string;
  href?: string;
}) {
  return (
    <header className="flex items-center gap-3">
      <Link
        href={href}
        aria-label="Cancelar"
        className="focus-visible:shadow-foco flex size-11 items-center justify-center rounded-full bg-linha-suave text-tinta outline-none"
      >
        <X className="size-6" strokeWidth={2.2} aria-hidden />
      </Link>
      <h1 className="text-[22px] font-extrabold tracking-tight">{title}</h1>
    </header>
  );
}
