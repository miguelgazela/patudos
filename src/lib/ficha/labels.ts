export const EVENT_TYPE_LABEL: Record<string, string> = {
  vaccine: "Vacina",
  deworming_internal: "Desparasitação interna",
  deworming_external: "Desparasitação externa",
  surgery: "Cirurgia",
  lab_test: "Análise",
  other: "Outro",
};

export const EXPENSE_CATEGORY_LABEL: Record<string, string> = {
  veterinary: "Veterinário",
  medication: "Medicamentos",
  food: "Alimentação",
  hygiene: "Higiene",
  accessories: "Acessórios",
  insurance: "Seguro",
  boarding: "Hotel / pet sitter",
  other: "Outro",
};

export const DOCUMENT_KIND_LABEL: Record<string, string> = {
  invoice: "Fatura",
  health_record: "Boletim sanitário",
  insurance: "Seguro",
  microchip: "Chip",
  other: "Outro",
};

export function eventTypeLabel(type: string): string {
  return EVENT_TYPE_LABEL[type] ?? "Registo";
}
