"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { ActiveBadge } from "@/components/common/badges";
import { Field } from "@/components/common/field";
import { collectErrorMessages, FormErrorSummary } from "@/components/common/form-error-summary";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState, ErrorState, LoadingState, StatusMessage } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useResource } from "@/hooks/use-resource";
import { slugify } from "@/lib/domain/rules";
import type { Institution } from "@/lib/domain/types";
import { errorMessage } from "@/lib/errors";
import { getServices } from "@/lib/services";
import {
  institutionFormSchema,
  newInstitutionFormSchema,
  type InstitutionFormInput,
  type NewInstitutionFormInput,
  type NewInstitutionFormValues,
} from "@/lib/validation/schemas";

/** Criar (com primeiro admin) ou editar uma instituição. */
export function InstitutionDialog({
  institution,
  open,
  onOpenChange,
  onSaved,
}: {
  institution?: Institution;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (inst: Institution, created: boolean) => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const editing = !!institution;
  const form = useForm<NewInstitutionFormInput, unknown, NewInstitutionFormValues>({
    resolver: zodResolver(
      editing
        ? institutionFormSchema.extend({
            adminName: newInstitutionFormSchema.shape.adminName.optional(),
            adminEmail: newInstitutionFormSchema.shape.adminEmail.optional(),
          })
        : newInstitutionFormSchema,
    ) as never,
    defaultValues: {
      name: institution?.name ?? "",
      slug: institution?.slug ?? "",
      domains: institution?.domains.join(", ") ?? "",
      adminName: "",
      adminEmail: "",
    },
  });
  const { register, handleSubmit, formState, setValue, getFieldState } = form;

  const submit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      if (institution) {
        const saved = await getServices().institutions.update(institution.id, {
          name: values.name,
          slug: values.slug,
          domains: values.domains,
        });
        onSaved(saved, false);
      } else {
        const saved = await getServices().institutions.create(values);
        form.reset();
        onSaved(saved, true);
      }
    } catch (e) {
      setServerError(errorMessage(e));
    }
  });

  const messages = [
    ...collectErrorMessages(formState.errors),
    ...(serverError ? [serverError] : []),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Editar instituição" : "Nova instituição"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Nome, identificador e domínios de login."
              : "Cria a instituição e convida o primeiro Admin da instituição."}
          </DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={submit} className="grid gap-4">
          <FormErrorSummary messages={messages} />
          <Field label="Nome da instituição" required error={formState.errors.name?.message}>
            <Input
              {...register("name", {
                onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                  if (!editing && !getFieldState("slug").isDirty)
                    setValue("slug", slugify(e.target.value));
                },
              })}
            />
          </Field>
          <Field
            label="Identificador (slug)"
            required
            error={formState.errors.slug?.message}
            description="Usado em URLs; minúsculas, números e hífens."
          >
            <Input {...register("slug")} />
          </Field>
          <Field
            label="Domínios de e-mail"
            required
            error={formState.errors.domains?.message}
            description="Separados por vírgula, ex.: escola.edu.br, aluno.escola.edu.br"
          >
            <Input {...register("domains")} />
          </Field>
          {!editing ? (
            <fieldset className="grid gap-3 rounded-md border p-3">
              <legend className="px-1 text-sm font-medium">Primeiro admin</legend>
              <Field label="Nome do admin" required error={formState.errors.adminName?.message}>
                <Input {...register("adminName")} />
              </Field>
              <Field label="E-mail do admin" required error={formState.errors.adminEmail?.message}>
                <Input type="email" {...register("adminEmail")} />
              </Field>
            </fieldset>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={formState.isSubmitting}>
              {editing ? "Salvar instituição" : "Criar instituição"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** /superadmin/instituicoes — CRUD e ativação de instituições (Super Admin). */
export function InstitutionsManager() {
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<{ open: boolean; institution?: Institution }>({
    open: false,
  });
  const [message, setMessage] = useState<{ kind: "ok" | "erro"; text: string } | null>(null);
  const list = useResource(
    () => getServices().institutions.list({ search: search || undefined }),
    `institutions:${search}`,
  );

  async function toggle(inst: Institution) {
    try {
      const saved = await getServices().institutions.update(inst.id, { active: !inst.active });
      setMessage({
        kind: "ok",
        text: `${saved.name} ${saved.active ? "reativada" : "desativada"}.`,
      });
      list.reload();
    } catch (e) {
      setMessage({ kind: "erro", text: errorMessage(e) });
    }
  }

  return (
    <>
      <PageHeader
        title="Instituições"
        description="Cada instituição tem seus próprios usuários, conteúdo e resultados. Instituições desativadas não conseguem entrar."
        actions={<Button onClick={() => setDialog({ open: true })}>Nova instituição</Button>}
      />
      <div className="mb-4 grid max-w-sm gap-1.5" role="search">
        <Label htmlFor="busca-inst">Buscar instituição</Label>
        <Input
          id="busca-inst"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <StatusMessage message={message} />
      {list.error ? (
        <ErrorState error={list.error} onRetry={list.reload} />
      ) : !list.data ? (
        <LoadingState />
      ) : list.data.length === 0 ? (
        <EmptyState title="Nenhuma instituição encontrada." />
      ) : (
        <ul className="grid gap-2" aria-label="Instituições">
          {list.data.map((inst) => (
            <li
              key={inst.id}
              data-testid="institution-item"
              className="bg-card flex flex-wrap items-center gap-3 rounded-lg border p-4"
            >
              <div className="min-w-48 flex-1">
                <p className="font-medium">{inst.name}</p>
                <p className="text-muted-foreground text-xs">
                  {inst.slug} · {inst.domains.join(", ")} · {inst.userCount} usuário(s)
                </p>
              </div>
              <ActiveBadge active={inst.active} />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDialog({ open: true, institution: inst })}
                aria-label={`Editar ${inst.name}`}
              >
                Editar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => toggle(inst)}
                aria-label={`${inst.active ? "Desativar" : "Reativar"} ${inst.name}`}
              >
                {inst.active ? "Desativar" : "Reativar"}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {dialog.open ? (
        <InstitutionDialog
          key={dialog.institution?.id ?? "new"}
          open
          institution={dialog.institution}
          onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
          onSaved={(inst, created) => {
            setDialog({ open: false });
            setMessage({
              kind: "ok",
              text: created
                ? `${inst.name} criada; convite enviado ao primeiro admin.`
                : `${inst.name} atualizada.`,
            });
            list.reload();
          }}
        />
      ) : null}
    </>
  );
}

export type { InstitutionFormInput };
