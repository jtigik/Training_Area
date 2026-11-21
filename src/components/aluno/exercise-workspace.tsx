"use client";

import Link from "next/link";
import { useDeferredValue, useId, useMemo, useRef, useState } from "react";
import { BookOpen, Lightbulb } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Markdown } from "@/components/common/markdown";
import { errorMessage } from "@/components/common/page-states";
import { FormulaBar } from "@/components/sheet/formula-bar";
import { SpreadsheetGrid } from "@/components/sheet/spreadsheet-grid";
import { LEVEL_LABELS, type AttemptResult, type Exercise, type StudentApi } from "@/lib/api";
import { formatValue, type EvaluatedValue } from "@/lib/formula/engine";
import { evaluateSheet } from "@/lib/formula/evaluate";
import { referencedCells } from "@/lib/formula/references";
import { DifficultyBadge, LevelBadge } from "./badges";
import { Breadcrumbs } from "./breadcrumbs";
import { FEEDBACK_MESSAGES } from "./feedback-messages";
import { exerciseHref, feedbackHref, levelAnchor } from "./level-card";

function rawContent(value: Exercise["sheet"]["cells"][string] | undefined): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "VERDADEIRO" : "FALSO";
  if (typeof value === "number") return String(value).replace(".", ",");
  return value;
}

function LocalResult({
  cell,
  value,
  pending,
}: {
  cell: string;
  value: EvaluatedValue;
  pending: boolean;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy={pending}
      className="min-h-12 rounded-md border bg-muted/50 px-3 py-2 text-sm"
    >
      <p className="text-xs font-medium text-muted-foreground">Resultado do teste</p>
      {value.kind === "empty" ? (
        <p className="text-muted-foreground">
          Digite uma fórmula na barra acima para ver o resultado em tempo real.
        </p>
      ) : value.kind === "error" ? (
        <p>
          <span className="font-formula font-semibold text-error">{value.code}</span> —{" "}
          {value.message}
        </p>
      ) : (
        <p>
          <span className="font-formula font-semibold">{cell}</span> ={" "}
          <span className="font-formula font-semibold">{formatValue(value)}</span>{" "}
          <span className="text-muted-foreground">(testes não contam como tentativa)</span>
        </p>
      )}
    </div>
  );
}

function SubmissionFeedback({ result, exercise }: { result: AttemptResult; exercise: Exercise }) {
  const headingId = useId();
  const next = exercise.position.nextExerciseId;
  return (
    <section
      role="status"
      aria-live="polite"
      aria-labelledby={headingId}
      className={
        result.correct
          ? "space-y-2 rounded-lg border border-success/40 bg-success-subtle p-4 text-success-subtle-foreground"
          : "space-y-2 rounded-lg border border-error/40 bg-error-subtle p-4 text-error-subtle-foreground"
      }
    >
      <h2 id={headingId} className="text-lg font-semibold">
        <span aria-hidden="true">{result.correct ? "✓ " : "✕ "}</span>
        {result.correct ? "Correto! Muito bem." : "Incorreto — ainda não foi dessa vez"}
      </h2>
      <p>{FEEDBACK_MESSAGES[result.feedbackCode]}</p>
      {result.errors.map((e) => (
        <p key={e.code + e.message} className="text-sm">
          <span className="font-formula">{e.code}</span> — {e.message}
        </p>
      ))}
      {!result.correct && result.hint && (
        <div data-testid="exercise-hint" className="rounded-md bg-card p-3 text-foreground">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <Lightbulb aria-hidden="true" className="size-4 text-warning" /> Dica do professor
          </p>
          <p>{result.hint}</p>
        </div>
      )}
      <div className="flex flex-wrap gap-2 pt-1">
        {result.levelCompleted ? (
          <Link href={feedbackHref(exercise.level)} className={buttonVariants()}>
            Ver feedback do nível
          </Link>
        ) : (
          result.correct &&
          next && (
            <Link href={exerciseHref(next)} className={buttonVariants()}>
              Próximo exercício
            </Link>
          )
        )}
        <Link
          href={`/aluno#${levelAnchor(exercise.level)}`}
          className={buttonVariants({ variant: "outline" })}
        >
          Voltar à trilha
        </Link>
      </div>
    </section>
  );
}

/**
 * Exercise screen: statement + grid + formula bar with live HyperFormula evaluation.
 * "Calcular"/Enter is a local test (not graded); "Enviar resposta" records an attempt
 * and the server's verdict is authoritative (TA-022).
 */
export function ExerciseWorkspace({
  exercise,
  submit,
}: {
  exercise: Exercise;
  submit: StudentApi["submitAttempt"];
}) {
  const { rows, cols, cells } = exercise.sheet;
  const target = exercise.targetCell;
  const editable = useMemo(() => new Set([target]), [target]);
  const formulaInput = useRef<HTMLInputElement>(null);
  const ids = { help: useId(), shortcuts: useId(), legend: useId() };

  const [selected, setSelected] = useState(target);
  const [committed, setCommitted] = useState(exercise.lastSubmission ?? "");
  const [draft, setDraft] = useState(exercise.lastSubmission ?? "");
  const [commitError, setCommitError] = useState<EvaluatedValue | null>(null);
  const [attempts, setAttempts] = useState(exercise.attempts);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const sheet = useMemo(() => evaluateSheet(cells, target, committed), [cells, target, committed]);
  const deferredDraft = useDeferredValue(draft);
  const preview = useMemo(
    () => evaluateSheet(cells, target, deferredDraft).target,
    [cells, target, deferredDraft],
  );
  const numeric = useMemo(
    () =>
      new Set(
        Object.entries(sheet.values)
          .filter(([, v]) => v.kind === "number")
          .map(([k]) => k),
      ),
    [sheet],
  );
  const errorCells = useMemo(
    () =>
      new Set(
        Object.entries(sheet.values)
          .filter(([, v]) => v.kind === "error")
          .map(([k]) => k),
      ),
    [sheet],
  );
  const highlighted = useMemo(
    () =>
      selected === target ? referencedCells(deferredDraft, { rows, cols }) : new Set<string>(),
    [selected, target, deferredDraft, rows, cols],
  );

  const isTargetSelected = selected === target;
  const barValue = isTargetSelected ? draft : rawContent(cells[selected]);

  function commit() {
    setCommitted(draft);
    const value = evaluateSheet(cells, target, draft).target;
    setCommitError(value.kind === "error" ? value : null);
  }

  function cancel() {
    setDraft(committed);
    document.querySelector<HTMLElement>(`[data-ref="${selected}"]`)?.focus();
  }

  function edit(ref: string, initialText?: string) {
    setSelected(ref);
    if (ref === target && initialText !== undefined) setDraft(initialText);
    formulaInput.current?.focus();
  }

  function restore() {
    setDraft("");
    setCommitted("");
    setCommitError(null);
    setResult(null);
    setSubmitError(null);
  }

  async function send() {
    const submission = draft;
    if (draft !== committed) commit();
    setSubmitError(null);
    // An empty answer is still sent: Backend 2 grades it as EMPTY_SUBMISSION (Incorreto),
    // which is what QA's F-110 case expects.
    setSubmitting(true);
    try {
      const local = evaluateSheet(cells, target, submission).target;
      const res = await submit(exercise.id, {
        submission,
        clientValue: local.kind === "empty" || local.kind === "error" ? null : local.value,
      });
      setResult(res);
      if (res.feedbackCode !== "EMPTY_SUBMISSION") setAttempts((n) => n + 1);
    } catch (e) {
      setSubmitError(errorMessage(e, "Não foi possível enviar sua resposta. Tente de novo."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <Breadcrumbs
        items={[
          { href: `/aluno#${levelAnchor(exercise.level)}`, label: LEVEL_LABELS[exercise.level] },
          { label: `Exercício ${exercise.position.index + 1} de ${exercise.position.total}` },
        ]}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <section aria-labelledby="titulo-exercicio" className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <LevelBadge level={exercise.level} />
            <DifficultyBadge difficulty={exercise.difficulty} />
          </div>
          <h1 id="titulo-exercicio" className="text-2xl font-semibold tracking-tight">
            {exercise.title}
          </h1>
          <Markdown>{exercise.statement}</Markdown>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-md border p-2">
              <dt className="text-muted-foreground">Célula-resposta</dt>
              <dd className="font-formula font-semibold">{target}</dd>
            </div>
            <div className="rounded-md border p-2">
              <dt className="text-muted-foreground">Tentativas</dt>
              <dd className="font-semibold">
                {attempts} {attempts === 1 ? "enviada" : "enviadas"}
              </dd>
            </div>
          </dl>
          {exercise.relatedSection && (
            <Link
              href={`/aluno/conteudo/${encodeURIComponent(exercise.relatedSection.id)}`}
              className="flex items-center gap-1.5 text-sm text-primary underline-offset-4 hover:underline"
            >
              <BookOpen aria-hidden="true" className="size-4" />
              Revisar conteúdo: {exercise.relatedSection.title}
            </Link>
          )}
          <details className="rounded-md border p-3 text-sm">
            <summary className="cursor-pointer font-medium">Atalhos da planilha</summary>
            <ul id={ids.shortcuts} className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <kbd>Setas</kbd> movem a seleção
              </li>
              <li>
                <kbd>Enter</kbd> ou <kbd>F2</kbd> editam a célula; digitar também começa a edição
              </li>
              <li>
                <kbd>Enter</kbd> confirma e calcula · <kbd>Esc</kbd> cancela
              </li>
              <li>
                <kbd>Tab</kbd> sai da planilha
              </li>
            </ul>
          </details>
        </section>

        <section aria-label="Área de trabalho" className="min-w-0 space-y-3">
          <FormulaBar
            cell={selected}
            value={barValue}
            readOnly={!isTargetSelected}
            onChange={setDraft}
            onCommit={commit}
            onCancel={cancel}
            inputRef={formulaInput}
            helpId={ids.help}
          />
          <p id={ids.help} className="text-xs text-muted-foreground">
            {isTargetSelected
              ? "Funções em português ou inglês. Separe argumentos com ponto e vírgula. Ex.: =SOMA(A1:A3)"
              : `A célula ${selected} está bloqueada (dados do enunciado). Selecione ${target} para responder.`}
          </p>
          <SpreadsheetGrid
            rows={rows}
            cols={cols}
            display={sheet.display}
            numeric={numeric}
            errors={errorCells}
            editable={editable}
            target={target}
            selected={selected}
            highlighted={highlighted}
            onSelect={setSelected}
            onEdit={edit}
            describedBy={ids.shortcuts}
            targetDescriptionId={ids.legend}
          />
          <p
            id={ids.legend}
            className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"
          >
            <span className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="size-3 border-2 border-dashed border-grid-target-border bg-grid-target"
              />
              Célula-resposta (editável)
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true" className="size-3 border bg-grid-locked" />
              Célula bloqueada (dados do enunciado)
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true" className="size-3 border bg-grid-range" />
              Intervalo usado na fórmula
            </span>
          </p>

          <LocalResult cell={target} value={preview} pending={deferredDraft !== draft} />

          {commitError?.kind === "error" && (
            <div
              role="alert"
              className="rounded-md border border-warning/50 bg-warning-subtle p-3 text-sm text-warning-subtle-foreground"
            >
              <p className="font-semibold">
                <span aria-hidden="true">⚠ </span>Fórmula com erro
              </p>
              <p>
                <span className="font-formula">{commitError.code}</span> — {commitError.message}
              </p>
            </div>
          )}

          {result && (
            <SubmissionFeedback key={result.attemptId} result={result} exercise={exercise} />
          )}
          {submitError && (
            <p role="alert" className="text-sm text-error">
              {submitError}
            </p>
          )}

          <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Quando estiver satisfeito(a) com o resultado em{" "}
              <span className="font-formula">{target}</span>, envie sua resposta.
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={restore} disabled={submitting}>
                Restaurar planilha
              </Button>
              <Button
                type="button"
                onClick={() => void send()}
                disabled={submitting}
                aria-busy={submitting}
              >
                {submitting ? "Enviando…" : "Enviar resposta"}
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
