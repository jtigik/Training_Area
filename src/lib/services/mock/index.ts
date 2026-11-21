import { validateAnswers } from "../../domain/grid";
import {
  canRedoLevel,
  filterAttempts,
  getPublishIssues,
  isLastActiveAdmin,
  validateBands,
} from "../../domain/rules";
import type { BankExercise, ContentSection, Exercise, ExerciseSet, User } from "../../domain/types";
import { ApiError, type Services } from "../contracts";
import { createSeed, DEFAULT_BANDS, MOCK_INSTITUTION_ID, type MockDb } from "./seed";

export interface MockOptions {
  /** Latência artificial em ms (0 nos testes). */
  latency?: number;
  db?: MockDb;
  /** Instituição da sessão simulada (admin da instituição e professor). */
  institutionId?: string;
  /** Usuário da sessão simulada (autor/revisor). */
  userId?: string;
  /** Chamado após cada operação (ex.: salvar em localStorage). */
  persist?: (db: MockDb) => void;
}

/** Remove o campo interno de tenant dos registros que não o expõem no DTO. */
function stripTenant<T extends { institutionId: string }>(record: T): Omit<T, "institutionId"> {
  const copy: Partial<T> = { ...record };
  delete copy.institutionId;
  return copy as Omit<T, "institutionId">;
}

const clone = <T>(v: T): T => structuredClone(v);
const now = () => new Date().toISOString();
let counter = 0;
const newId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}`;

/**
 * Implementação em memória de todos os serviços, com as mesmas regras e o
 * mesmo escopo por instituição esperados das APIs reais.
 */
export function createMockServices(options: MockOptions = {}): Services & { db: MockDb } {
  const db = options.db ?? createSeed();
  const latency = options.latency ?? 0;
  const tenant = options.institutionId ?? MOCK_INSTITUTION_ID;
  const actor = options.userId ?? "u-prof";

  const delay = <T>(fn: () => T): Promise<T> =>
    new Promise((resolve, reject) => {
      const run = () => {
        try {
          const result = clone(fn());
          options.persist?.(db);
          resolve(result);
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
  const mine = <T extends { institutionId: string | null }>(list: T[]) =>
    list.filter((x) => x.institutionId === tenant);
  const find = <T extends { id: string; institutionId: string | null }>(
    list: T[],
    id: string,
    what: string,
  ): T => list.find((x) => x.id === id && x.institutionId === tenant) ?? notFound(what);
  const findUser = (id: string) => find(db.users, id, "Usuário");
  const findSection = (id: string) => find(db.sections, id, "Seção");
  const findSet = (id: string) => find(db.sets, id, "Conjunto");
  const findExercise = (id: string) => find(db.exercises, id, "Exercício");
  const findReview = (id: string) => find(db.reviews, id, "Feedback");
  const findBank = (id: string): BankExercise =>
    db.bank.find((b) => b.id === id && (b.institutionId === null || b.institutionId === tenant)) ??
    notFound("Exercício do banco");
  const sortedSections = () => mine(db.sections).sort((a, b) => a.position - b.position);
  const emailTaken = (email: string, exceptId?: string) =>
    db.users.some((u) => u.email.toLowerCase() === email.trim().toLowerCase() && u.id !== exceptId);
  const students = () =>
    mine(db.users)
      .filter((u) => u.role === "STUDENT")
      .map(({ id, name, email }) => ({ id, name, email }));
  const assertLevelInSet = (set: ExerciseSet, level: Exercise["level"]) => {
    if (!set.levels.includes(level)) {
      throw new ApiError(
        422,
        "nivel_fora_do_conjunto",
        "O nível do exercício não faz parte do conjunto.",
      );
    }
  };
  const assertPending = (r: { status: string }) => {
    if (r.status !== "PENDING")
      throw new ApiError(409, "ja_revisado", "Este feedback já foi revisado.");
  };
  const countUsers = (institutionId: string) =>
    db.users.filter((u) => u.institutionId === institutionId).length;

  return {
    db,

    institutions: {
      list: (q = {}) =>
        delay(() => {
          const term = q.search?.trim().toLowerCase();
          return db.institutions
            .filter(
              (i) =>
                (!term || i.name.toLowerCase().includes(term) || i.slug.includes(term)) &&
                (q.active === undefined || i.active === q.active),
            )
            .map((i) => ({ ...i, userCount: countUsers(i.id) }))
            .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
        }),
      create: (input) =>
        delay(() => {
          if (db.institutions.some((i) => i.slug === input.slug)) {
            throw new ApiError(
              409,
              "slug_duplicado",
              "Já existe uma instituição com este identificador.",
            );
          }
          if (emailTaken(input.adminEmail)) {
            throw new ApiError(
              409,
              "email_duplicado",
              "Já existe um usuário com o e-mail do admin.",
            );
          }
          const inst = {
            id: newId("inst"),
            name: input.name.trim(),
            slug: input.slug,
            domains: input.domains,
            active: true,
            userCount: 1,
            createdAt: now(),
            updatedAt: now(),
          };
          db.institutions.push(inst);
          db.users.push({
            id: newId("u"),
            institutionId: inst.id,
            name: input.adminName.trim(),
            email: input.adminEmail.trim().toLowerCase(),
            role: "INSTITUTION_ADMIN",
            active: true,
            createdAt: now(),
            updatedAt: now(),
          });
          db.settings.push({
            institutionId: inst.id,
            instanceName: inst.name,
            openSignup: false,
            locale: "pt-BR",
            updatedAt: now(),
          });
          return inst;
        }),
      update: (id, input) =>
        delay(() => {
          const inst = db.institutions.find((i) => i.id === id) ?? notFound("Instituição");
          if (input.slug && db.institutions.some((i) => i.slug === input.slug && i.id !== id)) {
            throw new ApiError(
              409,
              "slug_duplicado",
              "Já existe uma instituição com este identificador.",
            );
          }
          Object.assign(inst, input, { updatedAt: now() });
          return { ...inst, userCount: countUsers(inst.id) };
        }),
    },

    users: {
      list: (q = {}) =>
        delay(() => {
          const term = q.search?.trim().toLowerCase();
          const page = Math.max(1, q.page ?? 1);
          const pageSize = Math.max(1, q.pageSize ?? 10);
          const items = mine(db.users)
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
            institutionId: tenant,
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
          const demoting = input.role !== undefined && input.role !== "INSTITUTION_ADMIN";
          const deactivating = input.active === false;
          if ((demoting || deactivating) && isLastActiveAdmin(db.users, id)) {
            throw new ApiError(
              409,
              "ultimo_admin",
              "Não é possível rebaixar ou desativar o último admin da instituição.",
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

    settings: {
      get: () =>
        delay(
          () => db.settings.find((s) => s.institutionId === tenant) ?? notFound("Configuração"),
        ),
      update: (input) =>
        delay(() => {
          const s = db.settings.find((x) => x.institutionId === tenant) ?? notFound("Configuração");
          return Object.assign(s, input, { updatedAt: now() });
        }),
    },

    sections: {
      list: () => delay(sortedSections),
      get: (id) => delay(() => findSection(id)),
      create: (input) =>
        delay(() => {
          const s: ContentSection = {
            id: newId("sec"),
            institutionId: tenant,
            ...input,
            position: mine(db.sections).length,
            status: "DRAFT",
            authorId: actor,
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
          // Arquivada volta como rascunho antes de ser publicada (TA-013).
          if (s.status === "ARCHIVED" && status === "PUBLISHED") {
            throw new ApiError(422, "transicao_invalida", "Restaure a seção antes de publicar.");
          }
          return Object.assign(s, { status, updatedAt: now() });
        }),
      reorder: (ids) =>
        delay(() => {
          const own = mine(db.sections);
          if (ids.length !== own.length || ids.some((id) => !own.find((s) => s.id === id))) {
            throw new ApiError(
              422,
              "ordem_invalida",
              "A lista de ordenação deve conter todas as seções.",
            );
          }
          ids.forEach((id, position) => Object.assign(findSection(id), { position }));
          return sortedSections();
        }),
      remove: (id) =>
        delay(() => {
          const s = findSection(id);
          if (s.status !== "DRAFT") {
            throw new ApiError(
              422,
              "remocao_invalida",
              "Só seções em rascunho podem ser excluídas; arquive as demais.",
            );
          }
          db.sections = db.sections.filter((x) => x.id !== id);
          sortedSections().forEach((x, i) => (x.position = i));
        }),
    },

    sets: {
      list: () => delay(() => mine(db.sets)),
      get: (id) => delay(() => findSet(id)),
      create: (input) =>
        delay(() => {
          const set: ExerciseSet = {
            id: newId("set"),
            institutionId: tenant,
            ...input,
            overrides: input.overrides.map((o) => ({ ...o, id: newId("ov") })),
            status: "DRAFT",
            authorId: actor,
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
                {
                  levels: blocked,
                },
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
          return Object.assign(set, { status: "PUBLISHED", updatedAt: now() });
        }),
      unpublish: (id) =>
        delay(() => Object.assign(findSet(id), { status: "DRAFT", updatedAt: now() })),
    },

    exercises: {
      listBySet: (setId) => delay(() => mine(db.exercises).filter((e) => e.setId === setId)),
      get: (id) => delay(() => findExercise(id)),
      create: (setId, input) =>
        delay(() => {
          assertLevelInSet(findSet(setId), input.level);
          if (validateAnswers(input.grid, input.answers).length) {
            throw new ApiError(422, "gabarito_invalido", "Gabarito incompleto.");
          }
          const ex: Exercise = {
            id: newId("ex"),
            institutionId: tenant,
            setId,
            bankItemId: null,
            ...input,
            createdAt: now(),
            updatedAt: now(),
          };
          db.exercises.push(ex);
          return ex;
        }),
      update: (id, input) =>
        delay(() => {
          const ex = findExercise(id);
          if (input.level) assertLevelInSet(findSet(ex.setId), input.level);
          const merged = { ...ex, ...input };
          if (validateAnswers(merged.grid, merged.answers).length) {
            throw new ApiError(422, "gabarito_invalido", "Gabarito incompleto.");
          }
          return Object.assign(ex, input, { updatedAt: now() });
        }),
      remove: (id) =>
        delay(() => {
          findExercise(id);
          db.exercises = db.exercises.filter((e) => e.id !== id);
        }),
    },

    bank: {
      list: (q = {}) =>
        delay(() => {
          const term = q.search?.trim().toLowerCase();
          return db.bank.filter(
            (b) =>
              (b.institutionId === null || b.institutionId === tenant) &&
              (!q.level || b.level === q.level) &&
              (!q.difficulty || b.difficulty === q.difficulty) &&
              (!q.origin || b.origin === q.origin) &&
              (!term ||
                b.title.toLowerCase().includes(term) ||
                b.tags.some((t) => t.toLowerCase().includes(term))),
          );
        }),
      get: (id) => delay(() => findBank(id)),
      create: (input) =>
        delay(() => {
          if (validateAnswers(input.grid, input.answers).length) {
            throw new ApiError(422, "gabarito_invalido", "Gabarito incompleto.");
          }
          const item: BankExercise = {
            id: newId("bank"),
            institutionId: tenant,
            origin: "INSTITUTION",
            source: "EDITOR",
            ...input,
            createdAt: now(),
            updatedAt: now(),
          };
          db.bank.push(item);
          return item;
        }),
      importMany: (items) =>
        delay(() => {
          const invalid = items.findIndex((i) => validateAnswers(i.grid, i.answers).length > 0);
          if (invalid >= 0) {
            throw new ApiError(
              422,
              "gabarito_invalido",
              `O item ${invalid + 1} está sem gabarito válido.`,
            );
          }
          const created = items.map<BankExercise>((input) => ({
            id: newId("bank"),
            institutionId: tenant,
            origin: "INSTITUTION",
            source: "XLSX",
            ...input,
            createdAt: now(),
            updatedAt: now(),
          }));
          db.bank.push(...created);
          return created;
        }),
      update: (id, input) =>
        delay(() => {
          const item = findBank(id);
          if (item.origin === "PLATFORM") {
            throw new ApiError(
              403,
              "item_da_plataforma",
              "Itens do banco inicial não podem ser editados; copie para um conjunto.",
            );
          }
          return Object.assign(item, input, { updatedAt: now() });
        }),
      remove: (id) =>
        delay(() => {
          const item = findBank(id);
          if (item.origin === "PLATFORM") {
            throw new ApiError(
              403,
              "item_da_plataforma",
              "Itens do banco inicial não podem ser excluídos.",
            );
          }
          db.bank = db.bank.filter((b) => b.id !== id);
        }),
      copyToSet: (id, setId) =>
        delay(() => {
          const item = findBank(id);
          const set = findSet(setId);
          assertLevelInSet(set, item.level);
          const { title, statement, level, difficulty, grid, answers, hint } = item;
          const ex: Exercise = {
            id: newId("ex"),
            institutionId: tenant,
            setId,
            bankItemId: item.id,
            title,
            statement,
            level,
            difficulty,
            grid: clone(grid),
            answers: clone(answers),
            hint,
            status: "DRAFT",
            createdAt: now(),
            updatedAt: now(),
          };
          db.exercises.push(ex);
          return ex;
        }),
    },

    feedback: {
      get: (setId) =>
        delay(() => {
          const t = db.feedback.find((f) => f.institutionId === tenant && f.setId === setId);
          if (t) return stripTenant(t);
          return {
            setId: null,
            bands: clone(DEFAULT_BANDS),
            updatedAt: "2026-11-10T13:00:00.000Z",
          };
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
          db.feedback = [
            ...db.feedback.filter((f) => !(f.institutionId === tenant && f.setId === input.setId)),
            { ...t, institutionId: tenant },
          ];
          return t;
        }),
    },

    reviews: {
      list: (q = {}) =>
        delay(() => {
          const term = q.search?.trim().toLowerCase();
          return mine(db.reviews)
            .filter(
              (r) =>
                (!q.status || r.status === q.status) &&
                (!q.level || r.level === q.level) &&
                (!term || r.studentName.toLowerCase().includes(term)),
            )
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        }),
      get: (id) => delay(() => findReview(id)),
      saveDraft: (id, finalText) =>
        delay(() => {
          const r = findReview(id);
          assertPending(r);
          return Object.assign(r, { finalText });
        }),
      approve: (id, finalText) =>
        delay(() => {
          const r = findReview(id);
          assertPending(r);
          if (!finalText.trim())
            throw new ApiError(422, "texto_vazio", "O feedback aprovado não pode ficar vazio.");
          return Object.assign(r, {
            finalText,
            status: "APPROVED",
            reviewerId: actor,
            reviewedAt: now(),
            rejectionReason: null,
          });
        }),
      reject: (id, reason) =>
        delay(() => {
          const r = findReview(id);
          assertPending(r);
          if (!reason.trim())
            throw new ApiError(422, "motivo_obrigatorio", "Informe o motivo da rejeição.");
          return Object.assign(r, {
            status: "REJECTED",
            reviewerId: actor,
            reviewedAt: now(),
            rejectionReason: reason,
          });
        }),
    },

    results: {
      list: (q = {}) =>
        delay(() => ({
          students: students(),
          attempts: filterAttempts(mine(db.attempts), q).map(stripTenant),
          progress: mine(db.progress)
            .filter((p) => (!q.setId || p.setId === q.setId) && (!q.level || p.level === q.level))
            .map(stripTenant),
        })),
      student: (id) =>
        delay(() => {
          const u = findUser(id);
          if (u.role !== "STUDENT") notFound("Aluno");
          return {
            student: { id: u.id, name: u.name, email: u.email },
            progress: mine(db.progress)
              .filter((p) => p.studentId === id)
              .map(stripTenant),
            attempts: mine(db.attempts)
              .filter((a) => a.studentId === id)
              .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
              .map(stripTenant),
          };
        }),
      redoLevel: (studentId, setId, level) =>
        delay(() => {
          findUser(studentId);
          const p =
            mine(db.progress).find(
              (x) => x.studentId === studentId && x.setId === setId && x.level === level,
            ) ?? notFound("Progresso");
          if (!canRedoLevel(p)) {
            throw new ApiError(
              409,
              "refazer_nao_permitido",
              "Só é possível refazer o nível com conceito ND ou ED.",
            );
          }
          const next = p.levelAttempt + 1;
          Object.assign(p, {
            levelAttempt: next,
            done: 0,
            correct: 0,
            status: "IN_PROGRESS",
            concept: null,
            completedAt: null,
          });
          p.history.push({
            levelAttempt: next,
            done: 0,
            correct: 0,
            concept: null,
            completedAt: null,
          });
          return stripTenant(p);
        }),
    },

    people: {
      students: () => delay(students),
      classrooms: () => delay(() => mine(db.classrooms)),
    },
  };
}
