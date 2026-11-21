/**
 * Contratos da camada de serviços da área do professor e do admin.
 *
 * A UI depende apenas destas interfaces. Hoje a implementação é o mock em
 * memória (`./mock`); quando os Backends 1 e 2 publicarem as APIs, basta
 * usar a implementação HTTP (`./http`) com NEXT_PUBLIC_API_MODE=http.
 *
 * Endpoints esperados (JSON, datas ISO 8601 UTC, erros no formato ApiErrorBody):
 *
 * Backend 1 — usuários, parâmetros, feedback
 *   GET    /api/admin/users?search=&role=&active=&page=&pageSize=   → Page<User>
 *   POST   /api/admin/users                 body CreateUserInput     → 201 User | 409 email_duplicado
 *   PATCH  /api/admin/users/:id             body UpdateUserInput     → User | 409 ultimo_admin
 *   GET    /api/admin/config                                         → InstanceConfig
 *   PUT    /api/admin/config                body UpdateInstanceConfigInput → InstanceConfig
 *   GET    /api/teacher/feedback-templates?setId=  (sem setId = padrão) → FeedbackTemplate
 *   PUT    /api/teacher/feedback-templates  body SaveFeedbackTemplateInput → FeedbackTemplate
 *
 * Backend 2 — conteúdo, conjuntos, exercícios, resultados
 *   GET    /api/teacher/sections                                     → ContentSection[] (ordenadas)
 *   GET    /api/teacher/sections/:id                                 → ContentSection
 *   POST   /api/teacher/sections            body SectionInput        → 201 ContentSection (rascunho)
 *   PATCH  /api/teacher/sections/:id        body Partial<SectionInput> → ContentSection
 *   POST   /api/teacher/sections/:id/status body { status }          → ContentSection
 *   PUT    /api/teacher/sections/order      body { ids: string[] }   → ContentSection[]
 *   DELETE /api/teacher/sections/:id        (só rascunho)            → 204
 *   GET    /api/teacher/sets                                         → ExerciseSet[]
 *   GET    /api/teacher/sets/:id                                     → ExerciseSet
 *   POST   /api/teacher/sets                body ExerciseSetInput    → 201 ExerciseSet
 *   PATCH  /api/teacher/sets/:id            body Partial<ExerciseSetInput> → ExerciseSet
 *   POST   /api/teacher/sets/:id/publish                             → ExerciseSet | 422 { issues }
 *   POST   /api/teacher/sets/:id/unpublish                           → ExerciseSet
 *   GET    /api/teacher/sets/:id/exercises                           → Exercise[]
 *   GET    /api/teacher/exercises/:id                                → Exercise
 *   POST   /api/teacher/sets/:id/exercises  body ExerciseInput       → 201 Exercise
 *   PATCH  /api/teacher/exercises/:id       body Partial<ExerciseInput> → Exercise
 *   DELETE /api/teacher/exercises/:id                                → 204
 *   GET    /api/teacher/classrooms          (v1.1 / TA-037)          → Classroom[]
 *   GET    /api/teacher/students                                     → User[] (papel aluno)
 *   GET    /api/teacher/results?setId=&level=&difficulty=&from=&to=  → ResultsData
 *   GET    /api/teacher/results/students/:id                         → StudentDetail
 */
import type {
  Attempt,
  Classroom,
  ContentSection,
  Difficulty,
  Exercise,
  ExerciseSet,
  FeedbackBand,
  FeedbackTemplate,
  InstanceConfig,
  Level,
  LevelProgress,
  Page,
  QuantityOverride,
  QuantityRule,
  Role,
  SectionStatus,
  User,
} from "../domain/types";

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/* ----------------------------- Usuários ---------------------------- */

export interface ListUsersQuery {
  search?: string;
  role?: Role;
  active?: boolean;
  page?: number;
  pageSize?: number;
}

export interface CreateUserInput {
  name: string;
  email: string;
  role: Role;
  /** "convite" envia e-mail; "senha_temporaria" gera senha provisória. */
  onboarding: "convite" | "senha_temporaria";
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  role?: Role;
  active?: boolean;
}

export interface UsersService {
  list(query?: ListUsersQuery): Promise<Page<User>>;
  create(input: CreateUserInput): Promise<User>;
  update(id: string, input: UpdateUserInput): Promise<User>;
}

export type UpdateInstanceConfigInput = Pick<InstanceConfig, "name" | "openSignup">;

export interface InstanceService {
  get(): Promise<InstanceConfig>;
  update(input: UpdateInstanceConfigInput): Promise<InstanceConfig>;
}

/* ----------------------------- Conteúdo ---------------------------- */

export interface SectionInput {
  title: string;
  body: string;
  level: Level | null;
}

export interface SectionsService {
  list(): Promise<ContentSection[]>;
  get(id: string): Promise<ContentSection>;
  create(input: SectionInput): Promise<ContentSection>;
  update(id: string, input: Partial<SectionInput>): Promise<ContentSection>;
  setStatus(id: string, status: SectionStatus): Promise<ContentSection>;
  reorder(ids: string[]): Promise<ContentSection[]>;
  remove(id: string): Promise<void>;
}

/* ------------------------ Conjuntos e exercícios -------------------- */

export interface ExerciseSetInput {
  name: string;
  description: string;
  levels: Level[];
  difficulties: Difficulty[];
  quantities: QuantityRule[];
  overrides: Omit<QuantityOverride, "id">[];
}

export interface ExerciseInput {
  title: string;
  statement: string;
  level: Level;
  difficulty: Difficulty;
  grid: Exercise["grid"];
  answers: Exercise["answers"];
  hint: string | null;
  published: boolean;
}

export interface ExerciseSetsService {
  list(): Promise<ExerciseSet[]>;
  get(id: string): Promise<ExerciseSet>;
  create(input: ExerciseSetInput): Promise<ExerciseSet>;
  update(id: string, input: Partial<ExerciseSetInput>): Promise<ExerciseSet>;
  publish(id: string): Promise<ExerciseSet>;
  unpublish(id: string): Promise<ExerciseSet>;
}

export interface ExercisesService {
  listBySet(setId: string): Promise<Exercise[]>;
  get(id: string): Promise<Exercise>;
  create(setId: string, input: ExerciseInput): Promise<Exercise>;
  update(id: string, input: Partial<ExerciseInput>): Promise<Exercise>;
  remove(id: string): Promise<void>;
}

/* ------------------------------ Feedback ---------------------------- */

export interface SaveFeedbackTemplateInput {
  setId: string | null;
  bands: Omit<FeedbackBand, "id">[];
}

export interface FeedbackService {
  get(setId: string | null): Promise<FeedbackTemplate>;
  save(input: SaveFeedbackTemplateInput): Promise<FeedbackTemplate>;
}

/* ----------------------------- Resultados --------------------------- */

export interface ResultsQuery {
  setId?: string;
  level?: Level;
  difficulty?: Difficulty;
  from?: string;
  to?: string;
}

export type StudentSummary = Pick<User, "id" | "name" | "email">;

export interface ResultsData {
  students: StudentSummary[];
  attempts: Attempt[];
  progress: LevelProgress[];
}

export interface StudentDetail {
  student: StudentSummary;
  progress: LevelProgress[];
  attempts: Attempt[];
}

export interface ResultsService {
  list(query?: ResultsQuery): Promise<ResultsData>;
  student(id: string): Promise<StudentDetail>;
}

export interface PeopleService {
  students(): Promise<StudentSummary[]>;
  classrooms(): Promise<Classroom[]>;
}

export interface Services {
  users: UsersService;
  instance: InstanceService;
  sections: SectionsService;
  sets: ExerciseSetsService;
  exercises: ExercisesService;
  feedback: FeedbackService;
  results: ResultsService;
  people: PeopleService;
}
