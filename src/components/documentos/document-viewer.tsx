"use client";

import {
  ChevronRight,
  ExternalLink,
  FileText,
  Pencil,
  ReceiptEuro,
  Share2,
  Stethoscope,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { ErrorBanner } from "@/components/auth/banner";
import { TextField } from "@/components/auth/text-field";
import { ConfirmDialog, Sheet } from "@/components/consulta/ui";
import { Button } from "@/components/ui/button";
import {
  deleteDocument,
  signDocumentUrl,
  updateDocument,
} from "@/lib/documentos/actions";
import type { DocumentDetail } from "@/lib/documentos/data";
import { DOCUMENT_CHIPS, type DocumentKind } from "@/lib/documentos/logic";
import { formatISODate } from "@/lib/dates";
import { DOCUMENT_KIND_LABEL } from "@/lib/ficha/labels";
import { formatCents } from "@/lib/units";

function fileNameFor(title: string, isPdf: boolean) {
  const base =
    title
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "documento";
  return `${base}.${isPdf ? "pdf" : "jpg"}`;
}

/** Ecrã 28 — Ver documento: ecrã inteiro (imagem com zoom por pinch, ou PDF), dados e ações. */
export function DocumentViewer({ doc }: { doc: DocumentDetail }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<Promise<File | null> | null>(null);

  function loadFile(url: string): Promise<File | null> {
    return fetch(url)
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) =>
        b
          ? new File([b], fileNameFor(doc.title, doc.isPdf), {
              type: doc.isPdf ? "application/pdf" : "image/jpeg",
            })
          : null,
      )
      .catch(() => null);
  }

  // Prepara o ficheiro já, para o «Partilhar» responder ao toque (o iOS exige gesto recente).
  useEffect(() => {
    if (doc.url && typeof navigator !== "undefined" && "share" in navigator) {
      fileRef.current = loadFile(doc.url);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.url]);

  async function share() {
    setMessage(null);
    const file = fileRef.current ? await fileRef.current : null;
    if (
      file &&
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [file] })
    ) {
      try {
        await navigator.share({ files: [file], title: doc.title });
      } catch {
        /* cancelado pelo utilizador */
      }
      return;
    }
    // Sem partilha de ficheiros: descarrega.
    const fresh = await signDocumentUrl(doc.id);
    if (!fresh.ok) {
      setMessage("Não conseguimos preparar o ficheiro. Tenta de novo.");
      return;
    }
    const a = document.createElement("a");
    a.href = fresh.url;
    a.download = fileNameFor(doc.title, doc.isPdf);
    a.rel = "noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function remove() {
    startTransition(async () => {
      const res = await deleteDocument(doc.id);
      if (!res.ok) {
        setConfirmOpen(false);
        setMessage(res.message);
        return;
      }
      router.replace(`/animais/${doc.petId}/documentos`);
    });
  }

  const actionCls =
    "focus-visible:shadow-foco flex min-h-[72px] min-w-[72px] flex-col items-center gap-1.5 rounded-capsula px-2 text-[13px] font-extrabold text-tinta outline-none";
  const iconWrap =
    "flex size-12 items-center justify-center rounded-full bg-linha-suave";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-tinta">
      <div className="flex items-center gap-2.5 px-3 pt-[max(env(safe-area-inset-top),16px)] pb-2.5 text-branco">
        <button
          type="button"
          onClick={() =>
            window.history.length > 1
              ? router.back()
              : router.replace(`/animais/${doc.petId}/documentos`)
          }
          aria-label="Fechar"
          className="focus-visible:shadow-foco bg-white/15 flex size-11 shrink-0 items-center justify-center rounded-full outline-none"
        >
          <X className="size-6" strokeWidth={2.2} aria-hidden />
        </button>
        <h1
          className="truncate text-[18px] font-extrabold"
          data-testid="doc-title"
        >
          {doc.title}
        </h1>
      </div>

      <div className="flex min-h-0 flex-1 [touch-action:pan-x_pan-y_pinch-zoom] items-center justify-center overflow-auto px-4">
        {doc.isPdf ? (
          <div className="flex flex-col items-center gap-4 text-center text-branco">
            <span className="bg-white/10 flex size-28 items-center justify-center rounded-cartao">
              <FileText className="size-14" strokeWidth={2} aria-hidden />
            </span>
            {doc.url ? (
              <a
                href={doc.url}
                target="_blank"
                rel="noreferrer"
                className="focus-visible:shadow-foco inline-flex h-botao items-center gap-2.5 rounded-capsula bg-branco px-6 text-corpo font-extrabold text-tinta outline-none"
              >
                <ExternalLink
                  className="size-6"
                  strokeWidth={2.2}
                  aria-hidden
                />
                Abrir PDF
              </a>
            ) : (
              <p className="text-corpo">Não conseguimos abrir o ficheiro.</p>
            )}
          </div>
        ) : doc.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={doc.url}
            alt={doc.title}
            data-testid="doc-image"
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <p className="text-corpo text-branco">
            Não conseguimos abrir o ficheiro.
          </p>
        )}
      </div>
      {!doc.isPdf && doc.url ? (
        <p className="pb-2 text-center text-[13px] font-bold text-pega">
          Afasta dois dedos para aumentar
        </p>
      ) : null}

      <section className="flex flex-col gap-3 rounded-t-painel bg-branco px-5 pt-2.5 pb-[max(env(safe-area-inset-bottom),24px)]">
        <div
          className="mx-auto h-[5px] w-11 shrink-0 rounded-capsula bg-pega"
          aria-hidden
        />
        {message ? <ErrorBanner>{message}</ErrorBanner> : null}
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-capsula bg-aviso-fundo px-3 py-1 text-[13px] font-extrabold text-aviso">
            {DOCUMENT_KIND_LABEL[doc.kind] ?? "Documento"}
          </span>
          <span className="rounded-capsula bg-linha-suave px-3 py-1 text-[13px] font-extrabold text-tinta-suave">
            {formatISODate(doc.date)}
          </span>
          {doc.petName ? (
            <span className="rounded-capsula bg-linha-suave px-3 py-1 text-[13px] font-extrabold text-tinta-suave">
              {doc.petName}
            </span>
          ) : null}
          {doc.addedBy ? (
            <span className="rounded-capsula bg-linha-suave px-3 py-1 text-[13px] font-extrabold text-tinta-suave">
              Adicionado por {doc.addedBy}
            </span>
          ) : null}
        </div>

        {doc.visit ? (
          <Link
            href={doc.visit.href}
            className="focus-visible:shadow-foco flex min-h-[52px] items-center gap-3 outline-none"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-menta text-pinheiro-escuro">
              <Stethoscope className="size-5" strokeWidth={2.2} aria-hidden />
            </span>
            <span className="flex-1 text-[16px] font-bold">
              {doc.visit.label}
            </span>
            <ChevronRight className="size-5 text-tinta-suave" aria-hidden />
          </Link>
        ) : null}
        {doc.expense ? (
          <Link
            href={doc.expense.href}
            className="focus-visible:shadow-foco flex min-h-[52px] items-center gap-3 outline-none"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-menta text-pinheiro-escuro">
              <ReceiptEuro className="size-5" strokeWidth={2.2} aria-hidden />
            </span>
            <span className="flex-1 text-[16px] font-bold">
              Despesa de {formatCents(doc.expense.cents)}
            </span>
            <ChevronRight className="size-5 text-tinta-suave" aria-hidden />
          </Link>
        ) : null}

        <div className="flex justify-around">
          <button
            type="button"
            onClick={() => void share()}
            className={actionCls}
          >
            <span className={iconWrap}>
              <Share2 className="size-6" strokeWidth={2.2} aria-hidden />
            </span>
            Partilhar
          </button>
          {doc.canEdit ? (
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className={actionCls}
            >
              <span className={iconWrap}>
                <Pencil className="size-6" strokeWidth={2.2} aria-hidden />
              </span>
              Editar
            </button>
          ) : null}
          {doc.canEdit ? (
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className={`${actionCls} text-atraso`}
            >
              <span className={`${iconWrap} bg-atraso-fundo`}>
                <Trash2 className="size-6" strokeWidth={2.2} aria-hidden />
              </span>
              Apagar
            </button>
          ) : null}
        </div>
        {!doc.canEdit ? (
          <p className="text-center text-legenda text-tinta-suave">
            Só quem adicionou o documento ou o dono do animal o pode editar ou
            apagar.
          </p>
        ) : null}
      </section>

      <EditSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        doc={doc}
        onSaved={() => {
          setEditOpen(false);
          router.refresh();
        }}
      />
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Apagar este documento?"
        confirmLabel="Apagar documento"
        cancelLabel="Manter"
        pending={pending}
        onConfirm={remove}
      >
        O ficheiro é apagado para sempre. A consulta ou a despesa a que estava
        ligado ficam como estão, sem anexo.
      </ConfirmDialog>
    </div>
  );
}

function EditSheet({
  open,
  onOpenChange,
  doc,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  doc: DocumentDetail;
  onSaved: () => void;
}) {
  const [kind, setKind] = useState<DocumentKind>(doc.kind as DocumentKind);
  const [title, setTitle] = useState(doc.title);
  const [date, setDate] = useState(doc.date);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setMessage(null);
    startTransition(async () => {
      const res = await updateDocument({ id: doc.id, kind, title, date });
      if (!res.ok) {
        setErrors(res.errors ?? {});
        setMessage(res.message);
        return;
      }
      setErrors({});
      onSaved();
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Editar documento">
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className="flex flex-col gap-4"
      >
        {message ? <ErrorBanner>{message}</ErrorBanner> : null}
        <div className="flex flex-col gap-2">
          <span id="edit-tipo" className="text-etiqueta">
            Tipo
          </span>
          <div
            role="radiogroup"
            aria-labelledby="edit-tipo"
            className="flex flex-wrap gap-2"
          >
            {DOCUMENT_CHIPS.map((c) => (
              <button
                key={c.kind}
                type="button"
                role="radio"
                aria-checked={kind === c.kind}
                onClick={() => setKind(c.kind)}
                className={
                  "focus-visible:shadow-foco flex h-chip items-center justify-center rounded-capsula px-4 text-etiqueta font-bold outline-none " +
                  (kind === c.kind
                    ? "bg-pinheiro text-branco"
                    : "bg-linha-suave text-tinta")
                }
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
        <TextField
          id="edit-title"
          name="title"
          label="Título"
          value={title}
          maxLength={120}
          autoComplete="off"
          onChange={(e) => setTitle(e.target.value)}
          error={errors.title}
        />
        <TextField
          id="edit-date"
          name="document_date"
          type="date"
          label="Data"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          error={errors.date}
        />
        <Button type="submit" disabled={pending}>
          {pending ? "A guardar…" : "Guardar"}
        </Button>
      </form>
    </Sheet>
  );
}
