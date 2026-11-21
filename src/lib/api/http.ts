import type { StudentApi } from "./client";
import {
  ApiError,
  isMvpLevel,
  STUDENT_API,
  type ApiErrorBody,
  type Exercise,
  type LoginOptions,
  type Section,
  type SessionUser,
  type Trail,
  type TrailLevel,
} from "./types";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    let code = `HTTP_${res.status}`;
    let details: unknown;
    let message =
      res.status === 401
        ? "Sua sessão expirou. Entre novamente."
        : "Não foi possível completar a solicitação.";
    try {
      const body = (await res.json()) as Partial<ApiErrorBody> & {
        message?: string;
        code?: string;
      };
      if (body.error) ({ code, message, details } = body.error);
      else if (typeof body.message === "string") {
        message = body.message;
        if (body.code) code = body.code;
      }
    } catch {
      /* body was not JSON */
    }
    throw new ApiError(res.status, code, message, details);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

const enc = encodeURIComponent;

/** Real backend client. Endpoints follow the contracts in ./types.ts. */
export const httpApi: StudentApi = {
  getLoginOptions: () => request<LoginOptions>("/api/login-options"),
  async startLogin(provider, callbackURL) {
    // Lazy import: the Better Auth client is only needed when actually signing in.
    const { signInWithProvider } = await import("@/lib/auth/auth-client");
    const { data, error } = await signInWithProvider(provider, callbackURL);
    if (error || !data) {
      throw new ApiError(
        error?.status ?? 500,
        error?.code ?? "LOGIN_FAILED",
        "Não foi possível iniciar o login.",
      );
    }
    if ("url" in data && data.url) return { kind: "redirect", url: data.url };
    if ("user" in data && data.user) return { kind: "signed-in", user: await httpApi.me() };
    throw new ApiError(500, "LOGIN_FAILED", "Não foi possível iniciar o login.");
  },
  async me() {
    const data = await request<{ user: SessionUser }>("/api/me");
    if (!data?.user) throw new ApiError(401, "UNAUTHENTICATED", "Sua sessão expirou.");
    return data.user;
  },
  async logout() {
    await request("/api/auth/sign-out", { method: "POST", body: "{}" });
  },
  async getTrail() {
    const trail = await request<Omit<Trail, "levels"> & { levels: { level: string }[] }>(
      `${STUDENT_API}/trail`,
    );
    // Dashboard is v1.1: drop any non-MVP level the backend might still return.
    return {
      ...trail,
      levels: (trail.levels ?? []).filter((l): l is TrailLevel => isMvpLevel(l.level)),
    } as Trail;
  },
  async getSection(id) {
    return mvpOnly(await request<Section>(`${STUDENT_API}/sections/${enc(id)}`), "Seção");
  },
  async getExercise(id) {
    return mvpOnly(await request<Exercise>(`${STUDENT_API}/exercises/${enc(id)}`), "Exercício");
  },
  submitAttempt: (id, req) =>
    request(`${STUDENT_API}/exercises/${enc(id)}/attempts`, {
      method: "POST",
      body: JSON.stringify(req),
    }),
  getLevelFeedback: (level) => request(`${STUDENT_API}/levels/${enc(level)}/feedback`),
  retakeLevel: (level) => request(`${STUDENT_API}/levels/${enc(level)}/redo`, { method: "POST" }),
};

/** Treat content of non-MVP levels (Dashboard) as not found. */
function mvpOnly<T extends { level: string | null }>(item: T, what: string): T {
  if (item.level !== null && !isMvpLevel(item.level)) {
    throw new ApiError(404, "NOT_FOUND", `${what} não encontrado.`);
  }
  return item;
}
