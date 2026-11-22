import { reactivatePet } from "@/lib/pets/actions";

import { Button } from "../ui/button";

export function ReactivateButton({
  petId,
  name,
}: {
  petId: string;
  name: string;
}) {
  return (
    <form action={reactivatePet.bind(null, petId)}>
      <Button type="submit" variant="secondary" className="h-12">
        Reativar<span className="sr-only"> {name}</span>
      </Button>
    </form>
  );
}
