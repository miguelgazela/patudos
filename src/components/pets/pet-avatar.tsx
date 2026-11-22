import { colorStyles, type PetColor } from "@/lib/pets/constants";
import { cn } from "@/lib/utils";

const DEFAULTS_PER_SPECIES = 4;

/** Escolha estável por animal: mesmo id, mesma imagem. */
export function defaultAvatarSrc(species: string, id: string): string {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const kind = species === "cat" ? "cat" : "dog";
  return `/avatars/${kind}-${(hash % DEFAULTS_PER_SPECIES) + 1}-256.webp`;
}

/** Foto redonda ou, sem foto, o avatar por espécie sobre o fundo na cor do animal; anel na cor do animal. */
export function PetAvatar({
  name,
  color,
  photoUrl,
  species,
  petId,
  className,
  ring = true,
}: {
  name: string;
  color: PetColor;
  photoUrl: string | null;
  species?: string;
  petId?: string;
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
      ) : species && petId ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={defaultAvatarSrc(species, petId)}
          alt=""
          className="size-full scale-110 object-cover"
        />
      ) : (
        <span aria-hidden>{name.trim().charAt(0).toUpperCase()}</span>
      )}
    </span>
  );
}
