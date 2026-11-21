/**
 * Contratos da camada de serviços das áreas do professor, do admin da
 * instituição e do super admin.
 *
 * A UI depende só destas interfaces. Hoje a implementação é o mock (`./mock`,
 * persistido em localStorage no navegador); com NEXT_PUBLIC_API_MODE=http a
 * UI usa `./http`, que chama os endpoints abaixo.
 *
 * Convenções: JSON; datas ISO 8601 UTC; enums iguais aos do Prisma; erros no
 * envelope `{ error: { code, message, details? } }` (code em UPPER_SNAKE) com status HTTP adequado
 * (401 sem sessão, 403 papel sem permissão, 404, 409 conflito, 422 regra).
 * Células (grade e gabarito): `number | string | boolean | null | { f: "=...", v? }`.
 * Fórmula só em `{ f }`; string iniciada por "=" é texto; 10 ≠ "10" (TC-036-02).
 * Multi-tenant: o servidor resolve `tenantId` pela sessão. Nenhum
 * endpoint de /api/admin ou /api/professor aceita tenantId do cliente.
 *
 * Backend 1 — instituições, usuários, configurações, feedback
 *   GET    /api/super-admin/institutions?search=&active=              → Institution[]
 *   POST   /api/super-admin/institutions     body CreateInstitutionInput → 201 Institution | 409 SLUG_IN_USE
 *   PATCH  /api/super-admin/institutions/:id body UpdateInstitutionInput → Institution
 *   GET    /api/admin/users?search=&role=&active=&page=&pageSize=   → Page<User>
 *   POST   /api/admin/users                 body CreateUserInput     → 201 User | 409 EMAIL_IN_USE
 *   PATCH  /api/admin/users/:id             body UpdateUserInput     → User | 409 LAST_ADMIN
 *   GET    /api/admin/config                                         → InstitutionSettings
 *   PUT    /api/admin/config                body UpdateSettingsInput → InstitutionSettings (inclui conceptThresholds { ED, D, PD }; 422 se não ED ≤ D ≤ PD)
 *   GET    /api/professor/feedback-templates?setId=  (sem setId = padrão) → FeedbackTemplate
 *   PUT    /api/professor/feedback-templates  body SaveFeedbackTemplateInput → FeedbackTemplate
 *   GET    /api/professor/feedback-reviews?status=DRAFT,REJECTED&level=&search= → ReviewFeedback[]
 *   GET    /api/professor/feedback-reviews/:id                         → ReviewFeedback
 *   PATCH  /api/professor/feedback-reviews/:id body { finalText }      → ReviewFeedback (só DRAFT ou REJECTED) | 409 ALREADY_REVIEWED
 *   POST   /api/professor/feedback-reviews/:id/approve body { finalText } → ReviewFeedback (DRAFT|REJECTED → APPROVED) | 409 ALREADY_REVIEWED
 *          | 409 GENERATION_NOT_READY — exige generationStatus GENERATED ou finalText não vazio (o professor pode escrever à mão após FAILED)
 *   POST   /api/professor/feedback-reviews/:id/reject  body { reason? }   → ReviewFeedback (DRAFT → REJECTED) | 409 ALREADY_REVIEWED
 *   POST   /api/professor/feedback-reviews/:id/regenerate             → ReviewFeedback (DRAFT|REJECTED → DRAFT, generationStatus PENDING, rejectionReason null)
 *          status = FeedbackStatus do BE1 (DRAFT "Pendente", APPROVED, REJECTED); o aluno só vê APPROVED.
 *          generationStatus = PENDING | GENERATED | FAILED (+ generationError); conteúdo: aiText (null se PENDING/FAILED), strengths[], toReview[].
 *
 * Backend 2 — conteúdo, conjuntos, exercícios, banco, resultados
 *   GET    /api/professor/sections                                     → ContentSection[] (por position)
 *   GET    /api/professor/sections/:id                                 → ContentSection
 *   POST   /api/professor/sections            body SectionInput        → 201 ContentSection (DRAFT)
 *   PATCH  /api/professor/sections/:id        body Partial<SectionInput> → ContentSection
 *   POST   /api/professor/sections/:id/status body { status }          → ContentSection
 *   PUT    /api/professor/sections/order      body { ids: string[] }   → ContentSection[]
 *   DELETE /api/professor/sections/:id        (só DRAFT)               → 204
 *   GET    /api/professor/sets                                         → ExerciseSet[]
 *   GET    /api/professor/sets/:id                                     → ExerciseSet
 *   POST   /api/professor/sets                body ExerciseSetInput    → 201 ExerciseSet (DRAFT)
 *   PATCH  /api/professor/sets/:id            body Partial<ExerciseSetInput> → ExerciseSet | 409 LEVEL_HAS_PROGRESS
 *   POST   /api/professor/sets/:id/publish                             → ExerciseSet (copia os exercícios PUBLISHED para SetExercise; publishedAt) | 422 PUBLISH_BLOCKED { issues }
 *   POST   /api/professor/sets/:id/unpublish                           → ExerciseSet
 *   GET    /api/professor/sets/:id/exercises?version=draft             → Exercise[] (rascunho, padrão)
 *   GET    /api/professor/sets/:id/exercises?version=published         → SetExercise[] (cópia feita ao publicar; [] se nunca publicado)
 *   GET    /api/professor/exercises/:id                                → Exercise
 *   POST   /api/professor/sets/:id/exercises  body ExerciseInput       → 201 Exercise | 422 LEVEL_NOT_IN_SET | INVALID_ANSWER_KEY
 *   PATCH  /api/professor/exercises/:id       body Partial<ExerciseInput> → Exercise
 *   DELETE /api/professor/exercises/:id                                → 204
 *   POST   /api/professor/sets/:id/exercises/import/preview  multipart `file` → 200 ImportPreview { drafts[], errors[] } (não grava)
 *          Datas da aba Planilha vêm como serial do Excel (número); cada draft traz `dateCells: string[]`
 *          (ex.: ["B2","C5"]) e a UI exibe essas células como dd/mm/aaaa.
 *   POST   /api/professor/sets/:id/exercises/import          multipart `file` → 201 { created: Exercise[] } (DRAFT)
 *          | 422 { error: { code: "IMPORT_INVALID" }, errors: ImportIssue[] }  — tudo ou nada
 *          Modelo do arquivo: abas Dados (Título, Nível, Dificuldade, Enunciado, Dica),
 *          Planilha (grade inicial) e Gabarito (Célula | Resposta), combinado com QA e BE2.
 *   GET    /api/professor/bank?level=&difficulty=&origin=&search=      → BankExercise[]
 *   GET    /api/professor/bank/:id                                     → BankExercise
 *   POST   /api/professor/bank                body BankExerciseInput   → 201 BankExercise (origin INSTITUTION)
 *   PATCH  /api/professor/bank/:id            body Partial<BankExerciseInput> → BankExercise | 403 PLATFORM_ITEM_READ_ONLY
 *   DELETE /api/professor/bank/:id                                     → 204 | 403 PLATFORM_ITEM_READ_ONLY
 *   POST   /api/professor/bank/:id/copy       body { setId }           → 201 Exercise (DRAFT) | 422 LEVEL_NOT_IN_SET
 *   GET    /api/professor/classrooms                                   → Classroom[]
 *   GET    /api/professor/students                                     → StudentSummary[]
 *   GET    /api/professor/results?setId=&level=&difficulty=&from=&to=  → ResultsData
 *   GET    /api/professor/results/students/:id                         → StudentDetail
 *   POST   /api/professor/results/students/:id/redo body { setId, level } → LevelProgress | 409 LEVEL_NOT_REDOABLE
 */
import type { ImportDraft, ImportIssue } from "../xlsx/import";
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
  SetExercise,
  SectionStatus,
  User,
} from "../domain/types";

/** Corpo de erro dentro do envelope `{ error: ApiErrorBody }`. */
export interface ApiErrorBody {
  /** UPPER_SNAKE (ex.: NOT_FOUND, ALREADY_REVIEWED, LEVEL_NOT_REDOABLE). */
  code: string;
  message: string;
  details?: unknown;
}

/** Envelope padrão de erro de todas as rotas (BE1/BE2). */
export interface ApiErrorEnvelope {
  error: ApiErrorBody;
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

export type UpdateSettingsInput = Pick<
  InstitutionSettings,
  "instanceName" | "openSignup" | "conceptThresholds"
>;

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

export type { ImportIssue, ImportDraft } from "../xlsx/import";

export interface ImportPreview {
  drafts: ImportDraft[];
  errors: ImportIssue[];
}

export interface ImportCreated {
  created: Exercise[];
}

export interface ExercisesService {
  /** Rascunho (editável) do conjunto. */
  listBySet(setId: string): Promise<Exercise[]>;
  /** Cópia publicada (o que os alunos recebem). */
  listPublished(setId: string): Promise<SetExercise[]>;
  get(id: string): Promise<Exercise>;
  create(setId: string, input: ExerciseInput): Promise<Exercise>;
  update(id: string, input: Partial<ExerciseInput>): Promise<Exercise>;
  remove(id: string): Promise<void>;
  /** Lê o .xlsx e devolve rascunhos + erros, sem gravar. */
  previewImport(setId: string, file: File): Promise<ImportPreview>;
  /** Importa tudo ou nada; erro 422 IMPORT_INVALID traz `details.errors: ImportIssue[]`. */
  importXlsx(setId: string, file: File): Promise<ImportCreated>;
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
  /** Uma ou mais situações (?status=DRAFT,REJECTED). Vazio = todas. */
  status?: ReviewStatus[];
  level?: Level;
  search?: string;
}

export interface ReviewService {
  list(query?: ReviewQuery): Promise<ReviewFeedback[]>;
  get(id: string): Promise<ReviewFeedback>;
  saveDraft(id: string, finalText: string): Promise<ReviewFeedback>;
  approve(id: string, finalText: string): Promise<ReviewFeedback>;
  /** Só DRAFT. O rejeitado volta ao professor (editar ou gerar de novo); nunca vai ao aluno. */
  reject(id: string, reason?: string): Promise<ReviewFeedback>;
  /** Gera um novo texto pela IA (DRAFT ou REJECTED) e volta para DRAFT. */
  regenerate(id: string): Promise<ReviewFeedback>;
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
