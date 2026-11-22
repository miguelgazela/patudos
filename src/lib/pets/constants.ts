export const PET_COLORS = [
  "laranja",
  "azul",
  "uva",
  "framboesa",
  "relva",
  "mar",
  "mel",
  "ardosia",
] as const;
export type PetColor = (typeof PET_COLORS)[number];

export const SPECIES = ["dog", "cat"] as const;
export type Species = (typeof SPECIES)[number];

/** Classes completas (o Tailwind só gera o que vê escrito por extenso). */
export const colorStyles: Record<
  PetColor,
  { label: string; bg: string; ring: string; text: string; soft: string }
> = {
  laranja: {
    label: "Laranja",
    bg: "bg-pet-laranja",
    ring: "ring-pet-laranja",
    text: "text-pet-laranja-texto",
    soft: "bg-pet-laranja-fundo",
  },
  azul: {
    label: "Azul",
    bg: "bg-pet-azul",
    ring: "ring-pet-azul",
    text: "text-pet-azul-texto",
    soft: "bg-pet-azul-fundo",
  },
  uva: {
    label: "Uva",
    bg: "bg-pet-uva",
    ring: "ring-pet-uva",
    text: "text-pet-uva-texto",
    soft: "bg-pet-uva-fundo",
  },
  framboesa: {
    label: "Framboesa",
    bg: "bg-pet-framboesa",
    ring: "ring-pet-framboesa",
    text: "text-pet-framboesa-texto",
    soft: "bg-pet-framboesa-fundo",
  },
  relva: {
    label: "Relva",
    bg: "bg-pet-relva",
    ring: "ring-pet-relva",
    text: "text-pet-relva-texto",
    soft: "bg-pet-relva-fundo",
  },
  mar: {
    label: "Mar",
    bg: "bg-pet-mar",
    ring: "ring-pet-mar",
    text: "text-pet-mar-texto",
    soft: "bg-pet-mar-fundo",
  },
  mel: {
    label: "Mel",
    bg: "bg-pet-mel",
    ring: "ring-pet-mel",
    text: "text-pet-mel-texto",
    soft: "bg-pet-mel-fundo",
  },
  ardosia: {
    label: "Ardósia",
    bg: "bg-pet-ardosia",
    ring: "ring-pet-ardosia",
    text: "text-pet-ardosia-texto",
    soft: "bg-pet-ardosia-fundo",
  },
};

export function isPetColor(value: string): value is PetColor {
  return (PET_COLORS as readonly string[]).includes(value);
}

/** A próxima cor livre (ou a primeira, se já estão todas em uso). */
export function nextFreeColor(used: readonly string[]): PetColor {
  return PET_COLORS.find((c) => !used.includes(c)) ?? PET_COLORS[0];
}

export const breedSuggestions: Record<Species, string[]> = {
  dog: [
    "Sem raça definida",
    "Serra da Estrela",
    "Podengo",
    "Labrador",
    "Pastor alemão",
    "Golden retriever",
    "Caniche",
    "Yorkshire terrier",
    "Chihuahua",
    "Bulldog francês",
    "Cão de água português",
    "Rafeiro do Alentejo",
    "Beagle",
    "Boxer",
  ],
  cat: [
    "Europeu comum",
    "Siamês",
    "Persa",
    "Maine Coon",
    "Ragdoll",
    "British shorthair",
    "Bengal",
    "Sphynx",
    "Norueguês da floresta",
  ],
};

export const sexLabels = { female: "Fêmea", male: "Macho" } as const;
