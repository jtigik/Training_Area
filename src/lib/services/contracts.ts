/**
 * Contratos da camada de serviços das áreas do professor, do admin da
 * instituição e do super admin.
 *
 * A UI depende só destas interfaces. Hoje a implementação é o mock (`./mock`,
 * persistido em localStorage no navegador); com NEXT_PUBLIC_API_MODE=http a
 * UI usa `./http`, que chama os endpoints abaixo.
 *
 * Convenções: JSON; datas ISO 8601 UTC; enums iguais aos do Prisma; erros no
 * formato ApiErrorBody `{ code, message, details? }` com status HTTP adequado
 * (401 sem sessão, 403 papel sem permissão, 404, 409 conflito, 422 regra).
 * Multi-tenant: o servidor resolve `institutionId` pela sessão. Nenhum
 * endpoint de /api/admin ou /api/teacher aceita institutionId do cliente.
 *
 * Backend 1 — instituições, usuários, configurações, feedback
 *   GET    /api/superadmin/institutions?search=&active=              → Institution[]
 *   POST   /api/superadmin/institutions     body CreateInstitutionInput → 201 Institution | 409 slug_duplicado
 *   PATCH  /api/superadmin/institutions/:id body UpdateInstitutionInput → Institution
 *   GET    /api/admin/users?search=&role=&active=&page=&pageSize=   → Page<User>
 *   POST   /api/admin/users                 body CreateUserInput     → 201 User | 409 email_duplicado
 *   PATCH  /api/admin/users/:id             body UpdateUserInput     → User | 409 ultimo_admin
 *   GET    /api/admin/config                                         → InstitutionSettings
 *   PUT    /api/admin/config                body UpdateSettingsInput → InstitutionSettings
 *   GET    /api/teacher/feedback-templates?setId=  (sem setId = padrão) → FeedbackTemplate
 *   PUT    /api/teacher/feedback-templates  body SaveFeedbackTemplateInput → FeedbackTemplate
 *   GET    /api/teacher/feedback-reviews?status=&level=&search=      → ReviewFeedback[]
 *   GET    /api/teacher/feedback-reviews/:id                         → ReviewFeedback
 *   PATCH  /api/teacher/feedback-reviews/:id body { finalText }      → ReviewFeedback (só PENDING)
 *   POST   /api/teacher/feedback-reviews/:id/approve body { finalText } → ReviewFeedback | 409 ja_revisado
 *   POST   /api/teacher/feedback-reviews/:id/reject  body { reason? }   → ReviewFeedback | 409 ja_revisado
 *
 * Backend 2 — conteúdo, conjuntos, exercícios, banco, resultados
 *   GET    /api/teacher/sections                                     → ContentSection[] (por position)
 *   GET    /api/teacher/sections/:id                                 → ContentSection
 *   POST   /api/teacher/sections            body SectionInput        → 201 ContentSection (DRAFT)
 *   PATCH  /api/teacher/sections/:id        body Partial<SectionInput> → ContentSection
 *   POST   /api/teacher/sections/:id/status body { status }          → ContentSection
 *   PUT    /api/teacher/sections/order      body { ids: string[] }   → ContentSection[]
 *   DELETE /api/teacher/sections/:id        (só DRAFT)               → 204
 *   GET    /api/teacher/sets                                         → ExerciseSet[]
 *   GET    /api/teacher/sets/:id                                     → ExerciseSet
 *   POST   /api/teacher/sets                body ExerciseSetInput    → 201 ExerciseSet (DRAFT)
 *   PATCH  /api/teacher/sets/:id            body Partial<ExerciseSetInput> → ExerciseSet | 409 nivel_com_progresso
 *   POST   /api/teacher/sets/:id/publish                             → ExerciseSet | 422 publicacao_bloqueada { issues }
 *   POST   /api/teacher/sets/:id/unpublish                           → ExerciseSet
 *   GET    /api/teacher/sets/:id/exercises                           → Exercise[]
 *   GET    /api/teacher/exercises/:id                                → Exercise
 *   POST   /api/teacher/sets/:id/exercises  body ExerciseInput       → 201 Exercise | 422 nivel_fora_do_conjunto | gabarito_invalido
 *   PATCH  /api/teacher/exercises/:id       body Partial<ExerciseInput> → Exercise
 *   DELETE /api/teacher/exercises/:id                                → 204
 *   GET    /api/teacher/bank?level=&difficulty=&origin=&search=      → BankExercise[]
 *   GET    /api/teacher/bank/:id                                     → BankExercise
 *   POST   /api/teacher/bank                body BankExerciseInput   → 201 BankExercise (origin INSTITUTION)
 *   POST   /api/teacher/bank/import         body { items: BankExerciseInput[] } → 201 BankExercise[] (source XLSX, DRAFT)
 *          (o .xlsx é lido no navegador; o QA mapeou também POST /api/teacher/exercises/import multipart — a definir com o BE2)
 *   PATCH  /api/teacher/bank/:id            body Partial<BankExerciseInput> → BankExercise | 403 item_da_plataforma
 *   DELETE /api/teacher/bank/:id                                     → 204 | 403 item_da_plataforma
 *   POST   /api/teacher/bank/:id/copy       body { setId }           → 201 Exercise (DRAFT) | 422 nivel_fora_do_conjunto
 *   GET    /api/teacher/classrooms                                   → Classroom[]
 *   GET    /api/teacher/students                                     → StudentSummary[]
 *   GET    /api/teacher/results?setId=&level=&difficulty=&from=&to=  → ResultsData
 *   GET    /api/teacher/results/students/:id                         → StudentDetail
 *   POST   /api/teacher/results/students/:id/redo body { setId, level } → LevelProgress | 409 refazer_nao_permitido
 */
import type {
  Attempt,
  BankExercise,
  BankOrigin,
  Classroom,
  ContentSection,
  Difficulty,
  Exercise,
  ExerciseContent,
  ExerciseSet,
  ExerciseSetStatus,
  FeedbackBand,
  FeedbackTemplate,
  Institution,
  InstitutionRole,
  InstitutionSettings,
  Level,
  LevelProgress,
  Page,
  QuantityOverride,
  QuantityRule,
  ReviewFeedback,
  ReviewStatus,
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

/* --------------------------- Instituições --------------------------- */

export interface ListInstitutionsQuery {
  search?: string;
  active?: boolean;
}

export interface CreateInstitutionInput {
  name: string;
  slug: string;
  domains: string[];
  /** Primeiro admin da instituição (recebe convite). */
  adminName: string;
  adminEmail: string;
}

export interface UpdateInstitutionInput {
  name?: string;
  slug?: string;
  domains?: string[];
  active?: boolean;
}

export interface InstitutionsService {
  list(query?: ListInstitutionsQuery): Promise<Institution[]>;
  create(input: CreateInstitutionInput): Promise<Institution>;
  update(id: string, input: UpdateInstitutionInput): Promise<Institution>;
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
  role: InstitutionRole;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  role?: InstitutionRole;
  active?: boolean;
}

export interface UsersService {
  list(query?: ListUsersQuery): Promise<Page<User>>;
  create(input: CreateUserInput): Promise<User>;
  update(id: string, input: UpdateUserInput): Promise<User>;
}

export type UpdateSettingsInput = Pick<InstitutionSettings, "instanceName" | "openSignup">;

export interface SettingsService {
  get(): Promise<InstitutionSettings>;
  update(input: UpdateSettingsInput): Promise<InstitutionSettings>;
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

export interface ExerciseInput extends ExerciseContent {
  status: ExerciseSetStatus;
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

/* --------------------------- Banco de exercícios -------------------- */

export interface BankQuery {
  level?: Level;
  difficulty?: Difficulty;
  origin?: BankOrigin;
  search?: string;
}

export interface BankExerciseInput extends ExerciseContent {
  tags: string[];
  status: ExerciseSetStatus;
}

export interface BankService {
  list(query?: BankQuery): Promise<BankExercise[]>;
  get(id: string): Promise<BankExercise>;
  create(input: BankExerciseInput): Promise<BankExercise>;
  importMany(items: BankExerciseInput[]): Promise<BankExercise[]>;
  update(id: string, input: Partial<BankExerciseInput>): Promise<BankExercise>;
  remove(id: string): Promise<void>;
  copyToSet(id: string, setId: string): Promise<Exercise>;
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

export interface ReviewQuery {
  status?: ReviewStatus;
  level?: Level;
  search?: string;
}

export interface ReviewService {
  list(query?: ReviewQuery): Promise<ReviewFeedback[]>;
  get(id: string): Promise<ReviewFeedback>;
  saveDraft(id: string, finalText: string): Promise<ReviewFeedback>;
  approve(id: string, finalText: string): Promise<ReviewFeedback>;
  reject(id: string, reason?: string): Promise<ReviewFeedback>;
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
  /** Abre nova tentativa do nível (só com conceito ND ou ED). */
  redoLevel(studentId: string, setId: string, level: Level): Promise<LevelProgress>;
}

export interface PeopleService {
  students(): Promise<StudentSummary[]>;
  classrooms(): Promise<Classroom[]>;
}

export interface Services {
  institutions: InstitutionsService;
  users: UsersService;
  settings: SettingsService;
  sections: SectionsService;
  sets: ExerciseSetsService;
  exercises: ExercisesService;
  bank: BankService;
  feedback: FeedbackService;
  reviews: ReviewService;
  results: ResultsService;
  people: PeopleService;
}
