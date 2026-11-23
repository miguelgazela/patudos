import { FormHeader } from "@/components/pets/form-header";
import { MemorialForm } from "@/components/tributo/memorial-form";

// Ecrã 37: «Em memória de…». Cria logo um animal que já faleceu.
export default function EmMemoriaPage() {
  return (
    <>
      <FormHeader title="Em memória de…" />
      <p className="text-corpo text-tinta-suave">
        Para guardar a memória de um animal que já não está cá, mesmo que nunca
        tenha estado no Patudos.
      </p>
      <MemorialForm />
    </>
  );
}
