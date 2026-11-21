"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ConceptBadge, ProgressBadge } from "@/components/common/badges";
import { Field } from "@/components/common/field";
import { NativeSelect } from "@/components/common/native-select";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useResource } from "@/hooks/use-resource";
import { DIFFICULTY_LABELS, LEVEL_LABELS } from "@/lib/domain/labels";
import { buildStudentRows, formatDateTimeBR, type ResultsFilter } from "@/lib/domain/rules";
import { DIFFICULTIES, MVP_LEVELS, type Difficulty, type Level } from "@/lib/domain/types";
import { getServices } from "@/lib/services";

const PARAMS = {
  level: "level",
  difficulty: "difficulty",
  setId: "set",
  from: "from",
  to: "to",
} as const;

/** Lê os filtros da URL (compartilháveis e preservados ao voltar do detalhe). */
export function readFilter(params: URLSearchParams): ResultsFilter {
  const level = params.get(PARAMS.level);
  const difficulty = params.get(PARAMS.difficulty);
  return {
    level: (MVP_LEVELS as readonly string[]).includes(level ?? "") ? (level as Level) : undefined,
    difficulty: (DIFFICULTIES as readonly string[]).includes(difficulty ?? "")
      ? (difficulty as Difficulty)
      : undefined,
    setId: params.get(PARAMS.setId) || undefined,
    from: params.get(PARAMS.from) || undefined,
    to: params.get(PARAMS.to) || undefined,
  };
}

export function ResultsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const filter = readFilter(new URLSearchParams(params.toString()));
  const data = useResource(() => getServices().results.list(), "results");
  const sets = useResource(() => getServices().sets.list(), "sets");

  const update = (key: keyof typeof PARAMS, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(PARAMS[key], value);
    else next.delete(PARAMS[key]);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const filtering = !!(
    filter.level ||
    filter.difficulty ||
    filter.from ||
    filter.to ||
    filter.setId
  );
  const levels = filter.level ? [filter.level] : MVP_LEVELS;
  const rows = data.data
    ? buildStudentRows(
        data.data.students,
        data.data.attempts,
        data.data.progress,
        levels,
        filter,
      ).filter((r) => !filtering || r.attempts > 0)
    : [];
  const query = params.toString();

  return (
    <>
      <PageHeader
        title="Resultados"
        description="Status e conceito (ND, ED, D, PD) de cada aluno por nível. Datas no horário de Brasília."
      />
      <div
        className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6"
        role="search"
        aria-label="Filtrar resultados"
      >
        <Field label="Conjunto" className="lg:col-span-2">
          <NativeSelect
            value={filter.setId ?? ""}
            onChange={(e) => update("setId", e.target.value)}
          >
            <option value="">Todos</option>
            {(sets.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Nível">
          <NativeSelect
            value={filter.level ?? ""}
            onChange={(e) => update("level", e.target.value)}
          >
            <option value="">Todos</option>
            {MVP_LEVELS.map((l) => (
              <option key={l} value={l}>
                {LEVEL_LABELS[l]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Dificuldade">
          <NativeSelect
            value={filter.difficulty ?? ""}
            onChange={(e) => update("difficulty", e.target.value)}
          >
            <option value="">Todas</option>
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {DIFFICULTY_LABELS[d]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="De">
          <Input
            type="date"
            value={filter.from ?? ""}
            onChange={(e) => update("from", e.target.value)}
          />
        </Field>
        <Field label="Até">
          <Input
            type="date"
            value={filter.to ?? ""}
            onChange={(e) => update("to", e.target.value)}
          />
        </Field>
      </div>
      {filtering ? (
        <Button variant="ghost" size="sm" className="mb-2" onClick={() => router.replace(pathname)}>
          Limpar filtros
        </Button>
      ) : null}
      {data.error ? (
        <ErrorState error={data.error} onRetry={data.reload} />
      ) : !data.data ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState title="Nenhum resultado para esses filtros.">
          Tente outro período ou remova filtros.
        </EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <Table aria-label="Resultados da turma">
            <TableHeader>
              <TableRow>
                <TableHead>Aluno</TableHead>
                {levels.map((l) => (
                  <TableHead key={l}>{LEVEL_LABELS[l]}</TableHead>
                ))}
                <TableHead className="text-right">Tentativas</TableHead>
                <TableHead className="text-right">Acerto</TableHead>
                <TableHead>Última atividade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.student.id}>
                  <TableCell>
                    <Link
                      href={`/professor/resultados/alunos/${r.student.id}${query ? `?${query}` : ""}`}
                      className="font-medium hover:underline"
                    >
                      {r.student.name}
                    </Link>
                    <div className="text-muted-foreground text-xs">{r.student.email}</div>
                  </TableCell>
                  {levels.map((l) => {
                    const cell = r.levels[l];
                    return (
                      <TableCell key={l}>
                        {cell ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <ProgressBadge status={cell.status} />
                            {cell.concept ? <ConceptBadge concept={cell.concept} /> : null}
                            {cell.levelAttempt > 1 ? (
                              <span className="text-muted-foreground text-xs">
                                {cell.levelAttempt}ª vez
                              </span>
                            ) : null}
                            {cell.canRedo ? (
                              <span className="text-warning-subtle-foreground text-xs">
                                pode refazer
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-right tabular-nums">{r.attempts}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.attempts ? `${r.accuracy}%` : "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {r.lastActivity ? formatDateTimeBR(r.lastActivity) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
