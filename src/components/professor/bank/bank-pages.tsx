"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { DifficultyBadge, LevelBadge, SetStatusBadge } from "@/components/common/badges";
import { Field } from "@/components/common/field";
import { NativeSelect } from "@/components/common/native-select";
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
import { useResource } from "@/hooks/use-resource";
import { DIFFICULTY_LABELS, LEVEL_LABELS } from "@/lib/domain/labels";
import {
  DIFFICULTIES,
  MVP_LEVELS,
  type BankExercise,
  type BankOrigin,
  type Difficulty,
  type Level,
} from "@/lib/domain/types";
import { errorMessage } from "@/lib/errors";
import { getServices } from "@/lib/services";
import { ExerciseForm } from "../exercises/exercise-form";
import { XlsxImport } from "./xlsx-import";

const ORIGIN_LABELS: Record<BankOrigin, string> = {
  PLATFORM: "Banco inicial",
  INSTITUTION: "Minha instituição",
};

/** Diálogo "Usar em um conjunto": copia o item do banco para um conjunto do professor. */
function UseInSetDialog({
  item,
  defaultSetId,
  onClose,
  onDone,
}: {
  item: BankExercise | null;
  defaultSetId?: string;
  onClose: () => void;
  onDone: (text: string) => void;
}) {
  const sets = useResource(() => getServices().sets.list(), "sets");
  const [setId, setSetId] = useState(defaultSetId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const eligible = (sets.data ?? []).filter((s) => item && s.levels.includes(item.level));

  async function confirm() {
    if (!item) return;
    if (!setId) {
      setError("Escolha o conjunto.");
      return;
    }
    setBusy(true);
    try {
      await getServices().bank.copyToSet(item.id, setId);
      onDone(
        `“${item.title}” copiado para o conjunto ${sets.data?.find((s) => s.id === setId)?.name ?? ""}.`,
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!item} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Usar em um conjunto</DialogTitle>
          <DialogDescription>
            Uma cópia de “{item?.title}” entra no conjunto; o item do banco não muda.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}
        {sets.data ? (
          eligible.length ? (
            <Field label="Conjunto">
              <NativeSelect value={setId} onChange={(e) => setSetId(e.target.value)}>
                <option value="">Escolha…</option>
                {eligible.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          ) : (
            <p className="text-sm">
              Nenhum conjunto com o nível {item ? LEVEL_LABELS[item.level] : ""}.
            </p>
          )
        ) : (
          <LoadingState />
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={confirm} disabled={busy || !eligible.length}>
            Copiar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function BankPage() {
  const params = useSearchParams();
  const targetSet = params.get("conjunto") ?? undefined;
  const [level, setLevel] = useState<Level | "">("");
  const [difficulty, setDifficulty] = useState<Difficulty | "">("");
  const [origin, setOrigin] = useState<BankOrigin | "">("");
  const [search, setSearch] = useState("");
  const [using, setUsing] = useState<BankExercise | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "erro"; text: string } | null>(null);
  const query = {
    level: level || undefined,
    difficulty: difficulty || undefined,
    origin: origin || undefined,
    search: search || undefined,
  };
  const items = useResource(() => getServices().bank.list(query), `bank:${JSON.stringify(query)}`);

  return (
    <>
      <PageHeader
        title="Banco de exercícios"
        description="Use os exercícios do banco inicial ou da sua instituição nos conjuntos, crie novos pelo editor ou importe um .xlsx para um conjunto."
        actions={
          <Button asChild>
            <Link href="/professor/banco-exercicios/novo">Novo exercício</Link>
          </Button>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <section aria-labelledby="bank-list-title" className="grid content-start gap-4">
          <h2 id="bank-list-title" className="sr-only">
            Exercícios do banco
          </h2>
          <div
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
            role="search"
            aria-label="Filtrar exercícios"
          >
            <Field label="Buscar">
              <Input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Título ou tag"
              />
            </Field>
            <Field label="Nível">
              <NativeSelect value={level} onChange={(e) => setLevel(e.target.value as Level | "")}>
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
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as Difficulty | "")}
              >
                <option value="">Todas</option>
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>
                    {DIFFICULTY_LABELS[d]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Origem">
              <NativeSelect
                value={origin}
                onChange={(e) => setOrigin(e.target.value as BankOrigin | "")}
              >
                <option value="">Todas</option>
                <option value="PLATFORM">{ORIGIN_LABELS.PLATFORM}</option>
                <option value="INSTITUTION">{ORIGIN_LABELS.INSTITUTION}</option>
              </NativeSelect>
            </Field>
          </div>
          <StatusMessage message={message} />
          {items.error ? (
            <ErrorState error={items.error} onRetry={items.reload} />
          ) : !items.data ? (
            <LoadingState />
          ) : items.data.length === 0 ? (
            <EmptyState title="Nenhum exercício com esses filtros." />
          ) : (
            <ul className="grid gap-2" aria-label="Exercícios do banco">
              {items.data
                .filter((b) => b.level !== "DASHBOARD")
                .map((b) => (
                  <li
                    key={b.id}
                    data-testid="exercise-item"
                    className="bg-card flex flex-wrap items-center gap-2 rounded-lg border p-3"
                  >
                    <div className="min-w-48 flex-1">
                      <Link
                        href={`/professor/banco-exercicios/${b.id}`}
                        className="font-medium hover:underline"
                      >
                        {b.title}
                      </Link>
                      <p className="text-muted-foreground text-xs">
                        {ORIGIN_LABELS[b.origin]}
                        {b.source === "XLSX" ? " · importado de .xlsx" : ""}
                        {b.tags.length ? ` · ${b.tags.join(", ")}` : ""}
                      </p>
                    </div>
                    <LevelBadge level={b.level} />
                    <DifficultyBadge difficulty={b.difficulty} />
                    <SetStatusBadge status={b.status} />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={b.status !== "PUBLISHED"}
                      onClick={() => setUsing(b)}
                    >
                      Usar em conjunto
                    </Button>
                  </li>
                ))}
            </ul>
          )}
        </section>
        <XlsxImport defaultSetId={targetSet} />
      </div>
      {using ? (
        <UseInSetDialog
          item={using}
          defaultSetId={targetSet}
          onClose={() => setUsing(null)}
          onDone={(text) => {
            setUsing(null);
            setMessage({ kind: "ok", text });
          }}
        />
      ) : null}
    </>
  );
}

export function NewBankItemPage() {
  const router = useRouter();
  return (
    <>
      <PageHeader
        title="Novo exercício do banco"
        description="Fica no banco da sua instituição; publique para usar em conjuntos."
      />
      <ExerciseForm
        withTags
        onSubmit={async ({ tags, status, ...content }) => {
          const created = await getServices().bank.create({ ...content, tags, status });
          router.replace(`/professor/banco-exercicios/${created.id}`);
        }}
      />
    </>
  );
}

export function EditBankItemPage({ id }: { id: string }) {
  const router = useRouter();
  const item = useResource(() => getServices().bank.get(id), `bank-item:${id}`);
  const [message, setMessage] = useState<{ kind: "ok" | "erro"; text: string } | null>(null);
  if (item.error) return <ErrorState error={item.error} onRetry={item.reload} />;
  if (!item.data) return <LoadingState />;
  const b = item.data;

  if (b.origin === "PLATFORM") {
    return (
      <>
        <PageHeader
          title={b.title}
          description="Item do banco inicial (somente leitura). Duplique para adaptar à sua turma."
          actions={
            <Button
              onClick={async () => {
                try {
                  const copy = await getServices().bank.create({
                    title: `${b.title} (cópia)`,
                    statement: b.statement,
                    level: b.level,
                    difficulty: b.difficulty,
                    hint: b.hint,
                    grid: b.grid,
                    answers: b.answers,
                    tags: b.tags,
                    status: "DRAFT",
                  });
                  router.push(`/professor/banco-exercicios/${copy.id}`);
                } catch (e) {
                  setMessage({ kind: "erro", text: errorMessage(e) });
                }
              }}
            >
              Duplicar na minha instituição
            </Button>
          }
        />
        <StatusMessage message={message} />
        <div className="grid gap-2 text-sm">
          <div className="flex gap-2">
            <LevelBadge level={b.level} />
            <DifficultyBadge difficulty={b.difficulty} />
          </div>
          <p className="whitespace-pre-wrap">{b.statement}</p>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Editar exercício do banco"
        description={
          b.source === "XLSX" ? "Importado de .xlsx — confira a grade e o gabarito." : undefined
        }
        actions={<SetStatusBadge status={b.status} />}
      />
      <StatusMessage message={message} />
      <ExerciseForm
        key={b.updatedAt}
        withTags
        initial={b}
        onSubmit={async ({ tags, status, ...content }) => {
          item.setData(await getServices().bank.update(id, { ...content, tags, status }));
          setMessage({ kind: "ok", text: "Exercício salvo." });
        }}
      />
    </>
  );
}
