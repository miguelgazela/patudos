export default function Loading() {
  return (
    <div
      className="flex flex-col gap-4"
      aria-busy="true"
      aria-label="A carregar"
    >
      <div className="h-10 w-40 animate-pulse rounded-campo bg-esqueleto" />
      <div className="h-12 animate-pulse rounded-capsula bg-esqueleto" />
      <div className="h-56 animate-pulse rounded-cartao bg-esqueleto" />
      <div className="h-40 animate-pulse rounded-cartao bg-esqueleto" />
    </div>
  );
}
