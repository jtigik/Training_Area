"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Field } from "@/components/common/field";
import { NativeSelect } from "@/components/common/native-select";
import { LevelBadge, SetStatusBadge } from "@/components/common/badges";
import { useResource } from "@/hooks/use-resource";
import type { Exercise } from "@/lib/domain/types";
import { errorMessage } from "@/lib/errors";
import { ApiError, getServices, type ImportIssue } from "@/lib/services";
import { formatImportIssue } from "@/lib/xlsx/import";
import { validateXlsxFile, XLSX_MAX_BYTES } from "@/lib/validation/schemas";
import { GridPreview } from "./grid-preview";

type Result =
  | { kind: "error"; title: string; issues: ImportIssue[] }
  | { kind: "ok"; created: Exercise[]; setId: string }
  | { kind: "loading" };

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
export function XlsxImport({ defaultSetId }: { defaultSetId?: string }) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const sets = useResource(() => getServices().sets.list(), "sets");
  const [chosenSet, setChosenSet] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const setId = chosenSet ?? defaultSetId ?? sets.data?.[0]?.id ?? "";

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
      setResult({ kind: "loading" });
      const preview = await getServices().exercises.previewImport(setId, file);
      if (preview.errors.length) {
        setResult({
          kind: "error",
          title: "Nada foi importado. Corrija a planilha:",
          issues: preview.errors,
        });
        return;
      }
      const { created } = await getServices().exercises.importXlsx(setId, file);
      setResult({ kind: "ok", created, setId });
    } catch (e) {
      const issues =
        e instanceof ApiError && Array.isArray((e.details as { errors?: unknown })?.errors)
          ? (e.details as { errors: ImportIssue[] }).errors
          : [asIssue(errorMessage(e))];
      setResult({ kind: "error", title: "Nada foi importado.", issues });
    } finally {
      if (inputRef.current) inputRef.current.value = "";
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
          Até {XLSX_MAX_BYTES / 1024 / 1024} MB. Os exercícios entram no conjunto escolhido para
          você revisar.
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
        <div
          id={`${id}-result`}
          data-testid="import-result"
          role={result?.kind === "error" ? "alert" : undefined}
          aria-live="polite"
        >
          {result?.kind === "loading" ? (
            <p className="text-muted-foreground text-sm">Lendo a planilha…</p>
          ) : null}
          {result?.kind === "error" ? (
            <div className="border-destructive/40 bg-destructive/5 text-destructive rounded-md border p-3 text-sm">
              <p className="font-medium">{result.title}</p>
              {result.issues.length ? (
                <ul className="list-disc pl-5">
                  {result.issues.map((i, n) => (
                    <li key={n}>{formatImportIssue(i)}</li>
                  ))}
                </ul>
              ) : null}
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
