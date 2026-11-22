import type { MedicationDraft } from "@/lib/vet-visits/schedule";

export type TreatmentItem = {
  kind: "treatment";
  key: string;
  type: "vaccine" | "deworming_internal" | "deworming_external" | "other";
  title: string;
  presetId: string | null;
  product: string;
  /** Intervalo do preset: a próxima data acompanha a data da consulta até ser editada. */
  intervalMonths: number | null;
  nextDue: string;
  nextDueManual: boolean;
  remind: boolean;
};

export type MedicationItem = {
  kind: "medication";
  key: string;
  name: string;
  dose: string;
  draft: MedicationDraft;
  /** Descrição livre quando a frequência é «Outra». */
  otherFrequency: string;
  remind: boolean;
};

export type OtherItem = {
  kind: "other";
  key: string;
  type: "lab_test" | "surgery" | "other";
  title: string;
  notes: string;
};

export type Item = TreatmentItem | MedicationItem | OtherItem;

export type VisitDraft = {
  petId: string;
  visitDate: string;
  reason: string;
  vet: string;
  items: Item[];
  /** `null` = o peso não foi acrescentado. */
  weight: string | null;
  cost: string;
  /** `null` = eu. */
  paidBy: string | null;
  notes: string;
  documentId: string | null;
};
