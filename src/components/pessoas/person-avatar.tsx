import { cn } from "@/lib/utils";

// Classes por extenso (o Tailwind só gera o que vê escrito).
const COLORS = [
  "bg-pinheiro",
  "bg-pet-uva",
  "bg-pet-azul",
  "bg-pet-relva",
  "bg-pet-framboesa",
  "bg-pet-mar",
];

/** Avatar de pessoa: inicial sobre uma cor estável por pessoa. */
export function PersonAvatar({
  seed,
  name,
  className,
}: {
  seed: string;
  name: string;
  className?: string;
}) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-[46px] shrink-0 items-center justify-center rounded-full text-[18px] font-extrabold text-branco",
        COLORS[h % COLORS.length],
        className,
      )}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
