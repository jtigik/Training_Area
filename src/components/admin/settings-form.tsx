"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useState } from "react";
import { Field } from "@/components/common/field";
import { collectErrorMessages, FormErrorSummary } from "@/components/common/form-error-summary";
import { PageHeader } from "@/components/common/page-header";
import { ErrorState, LoadingState, StatusMessage } from "@/components/common/states";
import { SETTINGS_UPDATED_EVENT } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useResource } from "@/hooks/use-resource";
import { DEFAULT_CONCEPT_THRESHOLDS } from "@/lib/domain/rules";
import type { InstitutionSettings } from "@/lib/domain/types";
import { errorMessage } from "@/lib/errors";
import { getServices } from "@/lib/services";
import { settingsFormSchema, type SettingsFormValues } from "@/lib/validation/schemas";

/** /admin/configuracoes — parâmetros da instituição (TA-008). */
export function SettingsPage() {
  const settings = useResource(() => getServices().settings.get(), "settings");
  return (
    <>
      <PageHeader
        title="Configurações da instituição"
        description="Nome exibido no cabeçalho e regras de acesso."
      />
      {settings.error ? (
        <ErrorState error={settings.error} onRetry={settings.reload} />
      ) : !settings.data ? (
        <LoadingState />
      ) : (
        <SettingsForm settings={settings.data} />
      )}
    </>
  );
}

export function SettingsForm({ settings }: { settings: InstitutionSettings }) {
  const [message, setMessage] = useState<{ kind: "ok" | "erro"; text: string } | null>(null);
  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: {
      instanceName: settings.instanceName,
      openSignup: settings.openSignup,
      conceptThresholds: settings.conceptThresholds ?? DEFAULT_CONCEPT_THRESHOLDS,
    },
  });
  const { register, handleSubmit, formState } = form;

  const submit = handleSubmit(async (values) => {
    try {
      const saved = await getServices().settings.update(values);
      form.reset({
        instanceName: saved.instanceName,
        openSignup: saved.openSignup,
        conceptThresholds: saved.conceptThresholds,
      });
      window.dispatchEvent(new CustomEvent(SETTINGS_UPDATED_EVENT, { detail: saved }));
      setMessage({ kind: "ok", text: "Configurações salvas." });
    } catch (e) {
      setMessage({ kind: "erro", text: errorMessage(e) });
    }
  });

  return (
    <form noValidate onSubmit={submit} className="grid max-w-xl gap-4">
      <FormErrorSummary messages={collectErrorMessages(formState.errors)} />
      <Field
        label="Nome da instância"
        required
        error={formState.errors.instanceName?.message}
        description="Aparece no cabeçalho para todos os usuários da instituição."
      >
        <Input {...register("instanceName")} />
      </Field>
      <label className="flex cursor-pointer items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="accent-primary mt-0.5 size-4"
          {...register("openSignup")}
        />
        <span>
          Cadastro aberto para os domínios da instituição
          <span className="text-muted-foreground block text-xs">
            Contas Google/Microsoft desses domínios entram como aluno no primeiro login.
          </span>
        </span>
      </label>
      <fieldset className="grid gap-3 rounded-md border p-4">
        <legend className="px-1 text-sm font-medium">Limiares de conceito</legend>
        <p className="text-muted-foreground text-xs">
          Percentual mínimo de acerto no nível para cada conceito. Abaixo do mínimo de ED, o
          conceito é ND. Padrão: ED 50%, D 70%, PD 90%.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {(["ED", "D", "PD"] as const).map((c) => (
            <Field
              key={c}
              label={`Mínimo para ${c} (%)`}
              required
              error={formState.errors.conceptThresholds?.[c]?.message}
            >
              <Input
                type="number"
                min={1}
                max={100}
                inputMode="numeric"
                {...register(`conceptThresholds.${c}`, { valueAsNumber: true })}
              />
            </Field>
          ))}
        </div>
      </fieldset>
      <div>
        <Button type="submit" disabled={formState.isSubmitting}>
          Salvar
        </Button>
      </div>
      <StatusMessage message={message} />
    </form>
  );
}
