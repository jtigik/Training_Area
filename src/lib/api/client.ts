import type {
  AttemptRequest,
  AttemptResult,
  Exercise,
  KnowledgeLevel,
  LevelFeedback,
  LoginRequest,
  Section,
  SessionUser,
  Trail,
} from "./types";

/** Everything the student area needs from the backend. */
export interface StudentApi {
  login(req: LoginRequest): Promise<SessionUser>;
  /** Current user, or throws ApiError(401). */
  me(): Promise<SessionUser>;
  logout(): Promise<void>;
  getTrail(): Promise<Trail>;
  getSection(id: string): Promise<Section>;
  getExercise(id: string): Promise<Exercise>;
  submitAttempt(exerciseId: string, req: AttemptRequest): Promise<AttemptResult>;
  getLevelFeedback(level: KnowledgeLevel): Promise<LevelFeedback>;
}

export type ApiMode = "mock" | "http";

/** NEXT_PUBLIC_API_MODE=mock|http (default: mock until Backend 1/2 ship the endpoints). */
export function apiMode(): ApiMode {
  return process.env.NEXT_PUBLIC_API_MODE === "http" ? "http" : "mock";
}
