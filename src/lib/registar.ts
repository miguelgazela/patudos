import {
  FileText,
  ReceiptEuro,
  Scale,
  Stethoscope,
  Syringe,
  type LucideIcon,
} from "lucide-react";

export type RegistarAction = {
  slug: string;
  title: string;
  description: string;
  icon: LucideIcon;
  /** Ação principal do menu «+» (destaque). */
  featured?: boolean;
};

/** Ações do menu «+» (ecrã 6). */
export const registarActions: RegistarAction[] = [
  {
    slug: "consulta",
    title: "Consulta",
    description: "Vacinas, medicação, peso e custo de uma só vez",
    icon: Stethoscope,
    featured: true,
  },
  {
    slug: "tratamento",
    title: "Tratamento",
    description: "Vacina ou desparasitação em casa",
    icon: Syringe,
  },
  {
    slug: "peso",
    title: "Peso",
    description: "Pesar o teu animal",
    icon: Scale,
  },
  {
    slug: "despesa",
    title: "Despesa",
    description: "Ração, areia, brinquedos…",
    icon: ReceiptEuro,
  },
  {
    slug: "documento",
    title: "Documento",
    description: "Guardar uma foto ou um PDF",
    icon: FileText,
  },
];
