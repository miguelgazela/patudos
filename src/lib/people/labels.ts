export type Role = "owner" | "caregiver";

export const roleLabel: Record<Role, string> = {
  owner: "Dono",
  caregiver: "Cuidador",
};

/** «enviado há 3 dias». */
export function sentAgo(iso: string, now = new Date()): string {
  const days = Math.floor(
    (now.getTime() - new Date(iso).getTime()) / 86_400_000,
  );
  if (days <= 0) return "enviado hoje";
  if (days === 1) return "enviado ontem";
  return `enviado há ${days} dias`;
}
