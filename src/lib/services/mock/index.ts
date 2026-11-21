import {
  getPublishIssues,
  isLastActiveAdmin,
  filterAttempts,
  validateBands,
} from "../../domain/rules";
import { validateAnswers } from "../../domain/grid";
import type { ContentSection, User } from "../../domain/types";
import { ApiError, type Services } from "../contracts";
import { createSeed, DEFAULT_FEEDBACK, type MockDb } from "./seed";

export interface MockOptions {
  /** Latência artificial em ms (0 nos testes). */
  latency?: number;
  db?: MockDb;
}

const clone = <T>(v: T): T => structuredClone(v);
const now = () => new Date().toISOString();
let counter = 0;
const newId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}`;

/** Implementação em memória de todos os serviços, com as mesmas regras esperadas das APIs. */
export function createMockServices(options: MockOptions = {}): Services & { db: MockDb } {
  const db = options.db ?? createSeed();
  const latency = options.latency ?? 0;
  const delay = <T>(fn: () => T): Promise<T> =>
    new Promise((resolve, reject) => {
      const run = () => {
        try {
          resolve(clone(fn()));
        } catch (e) {
          reject(e);
        }
      };
      if (latency > 0) setTimeout(run, latency);
      else queueMicrotask(run);
    });

  const notFound = (what: string): never => {
    throw new ApiError(404, "nao_encontrado", `${what} não encontrado(a).`);
  };
  const findUser = (id: string) => db.users.find((u) => u.id === id) ?? notFound("Usuário");
  const findSection = (id: string) => db.sections.find((s) => s.id === id) ?? notFound("Seção");
  const findSet = (id: string) => db.sets.find((s) => s.id === id) ?? notFound("Conjunto");
  const findExercise = (id: string) =>
    db.exercises.find((e) => e.id === id) ?? notFound("Exercício");
  const sortedSections = () => [...db.sections].sort((a, b) => a.order - b.order);
  const emailTaken = (email: string, exceptId?: string) =>
    db.users.some((u) => u.email.toLowerCase() === email.toLowerCase() && u.id !== exceptId);

  return {
    db,
    users: {
      list: (q = {}) =>
        delay(() => {
          const term = q.search?.trim().toLowerCase();
          const page = Math.max(1, q.page ?? 1);
          const pageSize = Math.max(1, q.pageSize ?? 10);
          const items = db.users
            .filter(
              (u) =>
                (!term ||
                  u.name.toLowerCase().includes(term) ||
                  u.email.toLowerCase().includes(term)) &&
                (!q.role || u.role === q.role) &&
                (q.active === undefined || u.active === q.active),
            )
            .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
          return {
            items: items.slice((page - 1) * pageSize, page * pageSize),
            total: items.length,
            page,
            pageSize,
          };
        }),
      create: (input) =>
        delay(() => {
          if (emailTaken(input.email)) {
            throw new ApiError(409, "email_duplicado", "Já existe um usuário com este e-mail.");
          }
          const u: User = {
            id: newId("u"),
            name: input.name.trim(),
            email: input.email.trim().toLowerCase(),
            role: input.role,
            active: true,
            createdAt: now(),
            updatedAt: now(),
          };
          db.users.push(u);
          return u;
        }),
      update: (id, input) =>
        delay(() => {
          const u = findUser(id);
          const demoting = input.role !== undefined && input.role !== "ADMIN";
          const deactivating = input.active === false;
          if ((demoting || deactivating) && u.role === "ADMIN" && isLastActiveAdmin(db.users, id)) {
            throw new ApiError(
              409,
              "ultimo_admin",
              "Não é possível rebaixar ou desativar o último administrador.",
            );
          }
          if (input.email && emailTaken(input.email, id)) {
            throw new ApiError(409, "email_duplicado", "Já existe um usuário com este e-mail.");
          }
          Object.assign(u, {
            ...input,
            ...(input.email ? { email: input.email.trim().toLowerCase() } : {}),
            updatedAt: now(),
          });
          return u;
        }),
    },

    instance: {
      get: () => delay(() => db.instance),
      update: (input) =>
        delay(() => {
          db.instance = { ...db.instance, ...input, updatedAt: now() };
          return db.instance;
        }),
    },

    sections: {
      list: () => delay(sortedSections),
      get: (id) => delay(() => findSection(id)),
      create: (input) =>
        delay(() => {
          const s: ContentSection = {
            id: newId("sec"),
            ...input,
            order: db.sections.length,
            status: "rascunho",
            authorId: "u-prof",
            createdAt: now(),
            updatedAt: now(),
          };
          db.sections.push(s);
          return s;
        }),
      update: (id, input) =>
        delay(() => Object.assign(findSection(id), input, { updatedAt: now() })),
      setStatus: (id, status) =>
        delay(() => {
          const s = findSection(id);
          // Restaurar uma seção arquivada a devolve como rascunho (TA-013).
          if (s.status === "arquivado" && status === "publicado") {
            throw new ApiError(
              422,
              "transicao_invalida",
              "Restaure a seção como rascunho antes de publicar.",
            );
          }
          return Object.assign(s, { status, updatedAt: now() });
        }),
      reorder: (ids) =>
        delay(() => {
          if (
            ids.length !== db.sections.length ||
            ids.some((id) => !db.sections.find((s) => s.id === id))
          ) {
            throw new ApiError(
              422,
              "ordem_invalida",
              "A lista de ordenação deve conter todas as seções.",
            );
          }
          ids.forEach((id, order) => Object.assign(findSection(id), { order }));
          return sortedSections();
        }),
      remove: (id) =>
        delay(() => {
          const s = findSection(id);
          if (s.status !== "rascunho") {
            throw new ApiError(
              422,
              "remocao_invalida",
              "Só seções em rascunho podem ser excluídas; arquive as demais.",
            );
          }
          db.sections = db.sections.filter((x) => x.id !== id);
          sortedSections().forEach((x, i) => (x.order = i));
        }),
    },

    sets: {
      list: () => delay(() => db.sets),
      get: (id) => delay(() => findSet(id)),
      create: (input) =>
        delay(() => {
          const set = {
            id: newId("set"),
            ...input,
            overrides: input.overrides.map((o) => ({ ...o, id: newId("ov") })),
            status: "rascunho" as const,
            authorId: "u-prof",
            createdAt: now(),
            updatedAt: now(),
          };
          db.sets.push(set);
          return set;
        }),
      update: (id, input) =>
        delay(() => {
          const set = findSet(id);
          if (input.levels) {
            const removed = set.levels.filter((l) => !input.levels!.includes(l));
            const blocked = removed.filter((l) =>
              db.progress.some((p) => p.setId === id && p.level === l),
            );
            if (blocked.length) {
              throw new ApiError(
                409,
                "nivel_com_progresso",
                "Não é possível remover níveis que já têm progresso de alunos.",
                { levels: blocked },
              );
            }
          }
          const { overrides, ...rest } = input;
          Object.assign(set, rest, { updatedAt: now() });
          if (overrides) set.overrides = overrides.map((o) => ({ ...o, id: newId("ov") }));
          return set;
        }),
      publish: (id) =>
        delay(() => {
          const set = findSet(id);
          const issues = getPublishIssues(set, db.exercises);
          if (issues.length) {
            throw new ApiError(
              422,
              "publicacao_bloqueada",
              "O conjunto não atende às regras de quantidade.",
              { issues },
            );
          }
          return Object.assign(set, { status: "publicado", updatedAt: now() });
        }),
      unpublish: (id) =>
        delay(() => Object.assign(findSet(id), { status: "rascunho", updatedAt: now() })),
    },

    exercises: {
      listBySet: (setId) => delay(() => db.exercises.filter((e) => e.setId === setId)),
      get: (id) => delay(() => findExercise(id)),
      create: (setId, input) =>
        delay(() => {
          const set = findSet(setId);
          if (!set.levels.includes(input.level)) {
            throw new ApiError(
              422,
              "nivel_fora_do_conjunto",
              "O nível do exercício não faz parte do conjunto.",
            );
          }
          if (validateAnswers(input.grid, input.answers).length) {
            throw new ApiError(422, "gabarito_invalido", "Gabarito incompleto.");
          }
          const ex = { id: newId("ex"), setId, ...input, createdAt: now(), updatedAt: now() };
          db.exercises.push(ex);
          return ex;
        }),
      update: (id, input) =>
        delay(() => {
          const ex = findExercise(id);
          const set = findSet(ex.setId);
          if (input.level && !set.levels.includes(input.level)) {
            throw new ApiError(
              422,
              "nivel_fora_do_conjunto",
              "O nível do exercício não faz parte do conjunto.",
            );
          }
          return Object.assign(ex, input, { updatedAt: now() });
        }),
      remove: (id) =>
        delay(() => {
          findExercise(id);
          db.exercises = db.exercises.filter((e) => e.id !== id);
        }),
    },

    feedback: {
      get: (setId) =>
        delay(() => {
          const t = db.feedback.find((f) => f.setId === setId);
          return t ?? { ...DEFAULT_FEEDBACK, setId };
        }),
      save: (input) =>
        delay(() => {
          const errors = validateBands(input.bands);
          if (errors.length) throw new ApiError(422, "faixas_invalidas", errors.join(" "));
          const t = {
            setId: input.setId,
            bands: input.bands.map((b) => ({ ...b, id: newId("fb") })),
            updatedAt: now(),
          };
          db.feedback = [...db.feedback.filter((f) => f.setId !== input.setId), t];
          return t;
        }),
    },

    results: {
      list: (q = {}) =>
        delay(() => ({
          students: db.users
            .filter((u) => u.role === "STUDENT")
            .map(({ id, name, email }) => ({ id, name, email })),
          attempts: filterAttempts(db.attempts, q),
          progress: db.progress.filter(
            (p) => (!q.setId || p.setId === q.setId) && (!q.level || p.level === q.level),
          ),
        })),
      student: (id) =>
        delay(() => {
          const u = findUser(id);
          if (u.role !== "STUDENT") notFound("Aluno");
          return {
            student: { id: u.id, name: u.name, email: u.email },
            progress: db.progress.filter((p) => p.studentId === id),
            attempts: db.attempts
              .filter((a) => a.studentId === id)
              .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)),
          };
        }),
    },

    people: {
      students: () =>
        delay(() =>
          db.users
            .filter((u) => u.role === "STUDENT")
            .map(({ id, name, email }) => ({ id, name, email })),
        ),
      classrooms: () => delay(() => db.classrooms),
    },
  };
}
