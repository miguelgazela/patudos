import { NotFoundView } from "@/components/nav/error-view";

// 404 fora da área autenticada (ex.: um endereço que não existe).
export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pt-[max(env(safe-area-inset-top),32px)] pb-[max(env(safe-area-inset-bottom),32px)]">
      <NotFoundView />
    </main>
  );
}
