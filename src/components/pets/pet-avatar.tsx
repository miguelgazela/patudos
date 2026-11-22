import { colorStyles, type PetColor } from "@/lib/pets/constants";
import { cn } from "@/lib/utils";

/** Foto redonda ou, sem foto, a inicial sobre a cor do animal; anel na cor do animal. */
export function PetAvatar({
  name,
  color,
  photoUrl,
  className,
  ring = true,
}: {
  name: string;
  color: PetColor;
  photoUrl: string | null;
  className?: string;
  ring?: boolean;
}) {
  const style = colorStyles[color];
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full font-extrabold text-branco",
        style.bg,
        ring && ["ring-4", style.ring],
        className,
      )}
    >
      {photoUrl ? (
        // URL assinada (Storage privado): next/image não acrescenta nada aqui.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt="" className="size-full object-cover" />
      ) : (
        <span aria-hidden>{name.trim().charAt(0).toUpperCase()}</span>
      )}
    </span>
  );
}
