"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Field } from "@/components/common/field";
import { NativeSelect } from "@/components/common/native-select";
import { PageHeader } from "@/components/common/page-header";
import { collectErrorMessages, FormErrorSummary } from "@/components/common/form-error-summary";
import { ErrorState, LoadingState, StatusMessage } from "@/components/common/states";
import { SectionStatusBadge } from "@/components/common/badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useResource } from "@/hooks/use-resource";
import { LEVEL_LABELS } from "@/lib/domain/labels";
import { MVP_LEVELS, type ContentSection, type SectionStatus } from "@/lib/domain/types";
import { errorMessage } from "@/lib/errors";
import { getServices } from "@/lib/services";
import { sectionFormSchema, type SectionFormValues } from "@/lib/validation/schemas";

export function EditSectionPage({ id }: { id: string }) {
  const section = useResource(() => getServices().sections.get(id), id);
  if (section.error) return <ErrorState error={section.error} onRetry={section.reload} />;
  if (!section.data) return <LoadingState />;
  return <SectionForm section={section.data} onChange={section.setData} />;
}

/** Ações de status por estado (nunca mostra Publicar e Despublicar juntos). */
const ACTIONS: Record<SectionStatus, { label: string; to: SectionStatus; ok: string }[]> = {
  DRAFT: [
    { label: "Publicar", to: "PUBLISHED", ok: "Seção liberada para os alunos." },
    { label: "Arquivar", to: "ARCHIVED", ok: "Seção arquivada." },
  ],
  PUBLISHED: [
    { label: "Despublicar", to: "DRAFT", ok: "Seção retirada dos alunos (nada foi apagado)." },
    { label: "Arquivar", to: "ARCHIVED", ok: "Seção arquivada." },
  ],
  ARCHIVED: [{ label: "Restaurar", to: "DRAFT", ok: "Seção restaurada para edição." }],
};

export function SectionForm({
  section,
  onChange,
}: {
  section?: ContentSection;
  onChange?: (s: ContentSection) => void;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<{ kind: "ok" | "erro"; text: string } | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const form = useForm<SectionFormValues>({
    resolver: zodResolver(sectionFormSchema),
    defaultValues: {
      title: section?.title ?? "",
      body: section?.body ?? "",
      level: (section?.level ?? null) as SectionFormValues["level"],
    },
  });
  const { register, handleSubmit, formState } = form;

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    setBusy(true);
    try {
      if (section) {
        const saved = await getServices().sections.update(section.id, values);
        onChange?.(saved);
        form.reset(values);
        setMessage({ kind: "ok", text: "Seção salva." });
      } else {
        const created = await getServices().sections.create(values);
        router.replace(`/professor/conteudo/${created.id}`);
      }
    } catch (e) {
      setServerError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  });

  async function changeStatus(to: SectionStatus, ok: string) {
    if (!section) return;
    setBusy(true);
    try {
      onChange?.(await getServices().sections.setStatus(section.id, to));
      setMessage({ kind: "ok", text: ok });
    } catch (e) {
      setMessage({ kind: "erro", text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  const body = useWatch({ control: form.control, name: "body" });
  const messages = [
    ...collectErrorMessages(formState.errors),
    ...(serverError ? [serverError] : []),
  ];

  return (
    <>
      <PageHeader
        title={section ? "Editar seção" : "Nova seção"}
        description="Texto de estudo em Markdown simples; use crases para fórmulas, ex.: `=SOMA(A1:A3)`."
        actions={
          section ? (
            <div className="flex flex-wrap items-center gap-2">
              <SectionStatusBadge status={section.status} />
              {ACTIONS[section.status].map((a) => (
                <Button
                  key={a.label}
                  variant="outline"
                  disabled={busy || formState.isDirty}
                  onClick={() => changeStatus(a.to, a.ok)}
                >
                  {a.label}
                </Button>
              ))}
            </div>
          ) : null
        }
      />
      <StatusMessage message={message} />
      <form noValidate onSubmit={onSubmit} className="grid gap-4 lg:grid-cols-2">
        <div className="grid gap-4 lg:col-span-2">
          <FormErrorSummary messages={messages} />
        </div>
        <div className="grid content-start gap-4">
          <Field label="Título" required error={formState.errors.title?.message}>
            <Input {...register("title")} />
          </Field>
          <Field
            label="Nível (opcional)"
            description="Associe a um nível para aparecer junto da trilha."
          >
            <NativeSelect
              {...register("level", { setValueAs: (v) => (v === "" || v === null ? null : v) })}
            >
              <option value="">Todos os níveis</option>
              {MVP_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {LEVEL_LABELS[l]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Conteúdo (Markdown)" required error={formState.errors.body?.message}>
            <Textarea rows={14} className="font-mono text-sm" {...register("body")} />
          </Field>
          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>
              Salvar
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.push("/professor/conteudo")}
            >
              Voltar à lista
            </Button>
          </div>
          {section && formState.isDirty ? (
            <p className="text-muted-foreground text-xs">
              Salve as alterações antes de mudar o status.
            </p>
          ) : null}
        </div>
        <section
          aria-label="Pré-visualização do conteúdo"
          className="bg-muted/30 rounded-lg border p-4"
        >
          <h2 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
            Como o aluno verá
          </h2>
          <div className="text-sm whitespace-pre-wrap">{body || "—"}</div>
        </section>
      </form>
    </>
  );
}
