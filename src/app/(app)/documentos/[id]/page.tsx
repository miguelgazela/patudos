import { Suspense } from "react";

import { DocumentViewer } from "@/components/documentos/document-viewer";
import { getDocumentDetail } from "@/lib/documentos/data";

// Ecrã 28: ver documento (ecrã inteiro).
export default function Page({ params }: PageProps<"/documentos/[id]">) {
  return (
    <Suspense fallback={<div className="flex-1" aria-hidden />}>
      <Detail params={params} />
    </Suspense>
  );
}

async function Detail({
  params,
}: {
  params: PageProps<"/documentos/[id]">["params"];
}) {
  const { id } = await params;
  return <DocumentViewer doc={await getDocumentDetail(id)} />;
}
