import type { StudentApi } from "./client";
import { ApiError, type ApiErrorBody, type SessionUser } from "./types";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    let code = `HTTP_${res.status}`;
    let message =
      res.status === 401
        ? "Sua sessão expirou. Entre novamente."
        : "Não foi possível completar a solicitação.";
    try {
      const body = (await res.json()) as Partial<ApiErrorBody> & {
        message?: string;
        code?: string;
      };
      if (body.error) ({ code, message } = body.error);
      else if (typeof body.message === "string") {
        message = body.message;
        if (body.code) code = body.code;
      }
    } catch {
      /* body was not JSON */
    }
    throw new ApiError(res.status, code, message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Real backend client. Endpoints follow the assumed contracts in ./types.ts. */
export const httpApi: StudentApi = {
  async startLogin(provider, callbackURL) {
    const res = await request<{ url?: string; redirect?: boolean; user?: SessionUser }>(
      "/api/auth/sign-in/social",
      { method: "POST", body: JSON.stringify({ provider, callbackURL }) },
    );
    if (res.url) return { kind: "redirect", url: res.url };
    if (res.user) return { kind: "signed-in", user: res.user };
    throw new ApiError(500, "LOGIN_FAILED", "Não foi possível iniciar o login.");
  },
  async me() {
    const data = await request<{ user: SessionUser } | null>("/api/auth/get-session");
    if (!data?.user) throw new ApiError(401, "UNAUTHENTICATED", "Sua sessão expirou.");
    return data.user;
  },
  async logout() {
    await request("/api/auth/sign-out", { method: "POST", body: "{}" });
  },
  getTrail: () => request("/api/student/trail"),
  getSection: (id) => request(`/api/student/sections/${encodeURIComponent(id)}`),
  getExercise: (id) => request(`/api/student/exercises/${encodeURIComponent(id)}`),
  submitAttempt: (id, req) =>
    request(`/api/student/exercises/${encodeURIComponent(id)}/attempts`, {
      method: "POST",
      body: JSON.stringify(req),
    }),
  getLevelFeedback: (level) => request(`/api/student/levels/${encodeURIComponent(level)}/feedback`),
  retakeLevel: (level) =>
    request(`/api/student/levels/${encodeURIComponent(level)}/retake`, { method: "POST" }),
};
