import {
  BookOpen,
  Cpu,
  FileText,
  Receipt,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

/** Ícone e cores por tipo de documento (ecrã 11). */
export const KIND_STYLE: Record<string, { icon: LucideIcon; tone: string }> = {
  invoice: { icon: Receipt, tone: "bg-aviso-fundo text-aviso" },
  health_record: { icon: BookOpen, tone: "bg-menta text-pinheiro-escuro" },
  insurance: {
    icon: ShieldCheck,
    tone: "bg-pet-azul-fundo text-pet-azul-texto",
  },
  microchip: { icon: Cpu, tone: "bg-pet-uva-fundo text-pet-uva-texto" },
  other: { icon: FileText, tone: "bg-linha-suave text-tinta-suave" },
};

export function kindStyle(kind: string) {
  return KIND_STYLE[kind] ?? KIND_STYLE.other!;
}
