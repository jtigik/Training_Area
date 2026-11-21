"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Field } from "@/components/common/field";
import { NativeSelect } from "@/components/common/native-select";
import { LevelBadge, SetStatusBadge } from "@/components/common/badges";
import { useResource } from "@/hooks/use-resource";
import type { Exercise } from "@/lib/domain/types";
import { errorMessage } from "@/lib/errors";
import { ApiError, getServices, type ImportDraft, type ImportIssue } from "@/lib/services";
import { formatImportIssue } from "@/lib/xlsx/import";
import { validateXlsxFile, XLSX_MAX_BYTES } from "@/lib/validation/schemas";
import { GridPreview } from "./grid-preview";

type Result =
  | { kind: "error"; title: string; issues: ImportIssue[] }
  | { kind: "preview"; file: File; setId: string; drafts: ImportDraft[]; errors: ImportIssue[] }
  | { kind: "ok"; created: Exercise[]; setId: string }
  | { kind: "loading"; text: string };

const asIssue = (message: string, code = "FILE_INVALID"): ImportIssue => ({
  sheet: null,
  row: null,
  column: null,
  cell: null,
  code,
  message,
});

/**
 * Importação de exercícios por .xlsx para um conjunto (contrato do BE2:
 * preview sem gravar → import tudo ou nada). Os exercícios entram como rascunho.
 */
function IssueList({ title, issues }: { title: string; issues: ImportIssue[] }) {
  return (
    <div
      role="alert"
      className="border-destructive/40 bg-destructive/5 text-destructive rounded-md border p-3 text-sm"
    >
      <p className="font-medium">{title}</p>
      {issues.length ? (
        <ul className="list-disc pl-5">
          {issues.map((i, n) => (
            <li key={n}>{formatImportIssue(i)}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function XlsxImport({ defaultSetId }: { defaultSetId?: string }) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const sets = useResource(() => getServices().sets.list(), "sets");
  const [chosenSet, setChosenSet] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const setId = chosenSet ?? defaultSetId ?? sets.data?.[0]?.id ?? "";

  const toIssues = (e: unknown) =>
    e instanceof ApiError && Array.isArray((e.details as { errors?: unknown })?.errors)
      ? (e.details as { errors: ImportIssue[] }).errors
      : [asIssue(errorMessage(e))];

  /** 1º passo: pré-visualiza sem gravar (BE2 /import/preview). */
  async function handleFile(file: File | undefined) {
    if (!file) return;
    try {
      if (!setId) {
        setResult({ kind: "error", title: "Escolha o conjunto de destino.", issues: [] });
        return;
      }
      const invalid = validateXlsxFile(file);
      if (invalid) {
        setResult({
          kind: "error",
          title: "Arquivo recusado: envie uma planilha no formato .xlsx.",
          issues: [asIssue(invalid)],
        });
        return;
      }
      setResult({ kind: "loading", text: "Lendo a planilha…" });
      const preview = await getServices().exercises.previewImport(setId, file);
      setResult({ kind: "preview", file, setId, ...preview });
    } catch (e) {
      setResult({ kind: "error", title: "Não foi possível ler a planilha.", issues: toIssues(e) });
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  /** 2º passo: reenvia o mesmo arquivo e grava tudo ou nada (BE2 /import). */
  async function confirm(file: File, target: string) {
    setResult({ kind: "loading", text: "Importando…" });
    try {
      const { created } = await getServices().exercises.importXlsx(target, file);
      setResult({ kind: "ok", created, setId: target });
    } catch (e) {
      setResult({ kind: "error", title: "Nada foi importado.", issues: toIssues(e) });
    }
  }

  const setName = (sid: string) => sets.data?.find((s) => s.id === sid)?.name ?? "";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Importar planilha .xlsx</CardTitle>
        <CardDescription>
          Modelo com as abas <strong>Dados</strong> (Título, Nível, Dificuldade, Enunciado, Dica),{" "}
          <strong>Planilha</strong> (grade inicial) e <strong>Gabarito</strong> (Célula | Resposta).
          Até {XLSX_MAX_BYTES / 1024 / 1024} MB. Primeiro você confere a pré-visualização; ao
          confirmar, os exercícios entram como rascunho no conjunto escolhido.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <Field label="Conjunto de destino">
          <NativeSelect value={setId} onChange={(e) => setChosenSet(e.target.value)}>
            {sets.data?.length ? null : <option value="">Nenhum conjunto</option>}
            {(sets.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        {sets.data && sets.data.length === 0 ? (
          <p className="text-sm">
            <Link href="/professor/conjuntos/novo" className="underline">
              Crie um conjunto
            </Link>{" "}
            para receber os exercícios importados.
          </p>
        ) : null}
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-file`}>Arquivo .xlsx</Label>
          <input
            ref={inputRef}
            id={`${id}-file`}
            data-testid="xlsx-import-input"
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            aria-describedby={`${id}-result`}
            className="file:bg-primary file:text-primary-foreground text-sm file:mr-3 file:rounded-md file:border-0 file:px-3 file:py-1.5"
            onChange={(e) => void handleFile(e.target.files?.[0])}
          />
        </div>
        <div id={`${id}-result`} data-testid="import-result" aria-live="polite">
          {result?.kind === "loading" ? (
            <p className="text-muted-foreground text-sm">{result.text}</p>
          ) : null}
          {result?.kind === "error" ? (
            <IssueList title={result.title} issues={result.issues} />
          ) : null}
          {result?.kind === "preview" ? (
            <div className="grid gap-3">
              {result.errors.length ? (
                <IssueList
                  title="Nada será importado. Corrija a planilha e envie de novo:"
                  issues={result.errors}
                />
              ) : (
                <>
                  <p className="text-sm font-medium">
                    Pré-visualização ({result.file.name}):{" "}
                    {result.drafts.length === 1
                      ? "1 exercício"
                      : `${result.drafts.length} exercícios`}{" "}
                    para o conjunto {setName(result.setId)}. Nada foi gravado ainda.
                  </p>
                  <ul className="grid gap-3" aria-label="Pré-visualização da importação">
                    {result.drafts.map((d, n) => (
                      <li key={n} className="grid gap-2 rounded-md border p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{d.title}</span>
                          <LevelBadge level={d.level} />
                        </div>
                        <GridPreview
                          grid={d.grid}
                          answers={d.answers}
                          label={`Pré-visualização da grade de ${d.title}`}
                          dateCells={d.dateCells}
                        />
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={result.errors.length > 0 || result.drafts.length === 0}
                  onClick={() => void confirm(result.file, result.setId)}
                >
                  Confirmar importação
                </Button>
                <Button type="button" variant="outline" onClick={() => setResult(null)}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : null}
          {result?.kind === "ok" ? (
            <div className="grid gap-3">
              <p className="text-success text-sm font-medium">
                {result.created.length === 1
                  ? "1 exercício importado"
                  : `${result.created.length} exercícios importados`}{" "}
                no conjunto {setName(result.setId)}. Revise e publique.
              </p>
              <ul className="grid gap-3" aria-label="Exercícios importados">
                {result.created.map((ex) => (
                  <li
                    key={ex.id}
                    data-testid="exercise-item"
                    className="grid gap-2 rounded-md border p-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/professor/exercicios/${ex.id}`}
                        className="font-medium hover:underline"
                      >
                        {ex.title}
                      </Link>
                      <LevelBadge level={ex.level} />
                      <SetStatusBadge status={ex.status} />
                    </div>
                    <GridPreview
                      grid={ex.grid}
                      answers={ex.answers}
                      label={`Grade importada de ${ex.title}`}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
