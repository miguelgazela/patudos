import { cn } from "@/lib/utils";

/** Bloco cinzento a pulsar (as formas seguem o ecrã que vai aparecer). */
export function Bone({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-campo bg-esqueleto", className)}
    />
  );
}

/** Esqueleto genérico de um ecrã: um título, uma linha e dois cartões. */
export function PageSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="A carregar"
      className="flex flex-col gap-4"
    >
      <Bone className="h-10 w-40" />
      <Bone className="h-12 rounded-capsula" />
      <Bone className="h-44 rounded-cartao" />
      <Bone className="h-32 rounded-cartao" />
    </div>
  );
}
