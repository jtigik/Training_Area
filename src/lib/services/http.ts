import type { User } from "@/lib/domain/types";
import { ApiError, type ApiErrorBody, type Services } from "./contracts";

/** Resposta de POST /api/admin/invitations (BE1). */
export interface InvitationDto {
  id: string;
  email: string;
  role: User["role"];
  expiresAt: string;
}

/** Convite pendente exibido como usuário inativo até o aceite. */
export function invitationToUser(inv: InvitationDto, name: string): User {
  const now = new Date().toISOString();
  return {
    id: inv.id,
    tenantId: null,
    name,
    email: inv.email,
    role: inv.role,
    active: false,
    createdAt: now,
    updatedAt: now,
  };
}

type Query = Record<string, string | number | boolean | undefined | null>;

function qs(query?: Query): string {
  if (!query) return "";
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(query))
    if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
}

/**
 * Converte a resposta de erro no ApiError. Formato padrão de todas as rotas
 * (BE1/BE2): `{ error: { code, message, details? } }`. A importação .xlsx
 * pode trazer `errors[]` no topo (422 IMPORT_INVALID); vira `details.errors`.
 */
export async function toApiError(res: Response): Promise<ApiError> {
  const body: unknown = await res.json().catch(() => null);
  const b = (body ?? {}) as { error?: Partial<ApiErrorBody>; errors?: unknown };
  const code = typeof b.error?.code === "string" ? b.error.code : "HTTP_ERROR";
  const fallback =
    code === "IMPORT_INVALID"
      ? "A planilha tem erros; nada foi importado."
      : res.statusText || "Algo deu errado. Tente novamente.";
  const message =
    typeof b.error?.message === "string" && b.error.message ? b.error.message : fallback;
  let details = b.error?.details;
  if (b.errors !== undefined) {
    details = { ...(typeof details === "object" && details ? details : {}), errors: b.errors };
  }
  if (code === "IMPORT_INVALID") {
    const d = (details ?? {}) as { errors?: unknown };
    details = { ...d, errors: Array.isArray(d.errors) ? d.errors : [] };
  }
  return new ApiError(res.status, code, message, details);
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: "include",
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw await toApiError(res);
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

/** Envio multipart do .xlsx (campo `file`). */
async function upload<T>(path: string, file: File): Promise<T> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(path, { method: "POST", credentials: "include", body: form });
  if (!res.ok) throw await toApiError(res);
  return (await res.json()) as T;
}

/** Implementação real (fetch) seguindo os endpoints documentados em `contracts.ts`. */
export function createHttpServices(): Services {
  const get = <T>(p: string, q?: Query) => request<T>("GET", p + qs(q));
  return {
    institutions: {
      list: (q) => get("/api/super-admin/institutions", { ...q }),
      create: (i) => request("POST", "/api/super-admin/institutions", i),
      update: (id, i) => request("PATCH", `/api/super-admin/institutions/${id}`, i),
    },
    users: {
      list: (q) => get("/api/admin/users", { ...q }),
      create: async (i) => {
        // BE1 (TA-007): criar usuário = convidar. `name` é preenchido no aceite.
        const { invitation } = await request<{ invitation: InvitationDto }>(
          "POST",
          "/api/admin/invitations",
          { email: i.email, role: i.role },
        );
        return invitationToUser(invitation, i.name);
      },
      update: async (id, i) => {
        const { role, ...rest } = i;
        let user: User | undefined;
        if (role !== undefined) {
          // BE1 (TA-002): PATCH /api/admin/users/:id/role { role } → { user }
          user = (await request<{ user: User }>("PATCH", `/api/admin/users/${id}/role`, { role }))
            .user;
        }
        if (Object.keys(rest).length > 0 || !user) {
          user = await request<User>("PATCH", `/api/admin/users/${id}`, rest);
        }
        return user;
      },
    },
    settings: {
      get: () => get("/api/admin/config"),
      update: (i) => request("PUT", "/api/admin/config", i),
    },
    sections: {
      list: () => get("/api/professor/sections"),
      get: (id) => get(`/api/professor/sections/${id}`),
      create: (i) => request("POST", "/api/professor/sections", i),
      update: (id, i) => request("PATCH", `/api/professor/sections/${id}`, i),
      setStatus: (id, status) =>
        request("POST", `/api/professor/sections/${id}/status`, { status }),
      reorder: (ids) => request("PUT", "/api/professor/sections/order", { ids }),
      remove: (id) => request("DELETE", `/api/professor/sections/${id}`),
    },
    sets: {
      list: () => get("/api/professor/sets"),
      get: (id) => get(`/api/professor/sets/${id}`),
      create: (i) => request("POST", "/api/professor/sets", i),
      update: (id, i) => request("PATCH", `/api/professor/sets/${id}`, i),
      publish: (id) => request("POST", `/api/professor/sets/${id}/publish`),
      unpublish: (id) => request("POST", `/api/professor/sets/${id}/unpublish`),
    },
    exercises: {
      listBySet: (setId) => get(`/api/professor/sets/${setId}/exercises`, { version: "draft" }),
      listPublished: (setId) =>
        get(`/api/professor/sets/${setId}/exercises`, { version: "published" }),
      get: (id) => get(`/api/professor/exercises/${id}`),
      create: (setId, i) => request("POST", `/api/professor/sets/${setId}/exercises`, i),
      update: (id, i) => request("PATCH", `/api/professor/exercises/${id}`, i),
      remove: (id) => request("DELETE", `/api/professor/exercises/${id}`),
      previewImport: (setId, file) =>
        upload(`/api/professor/sets/${setId}/exercises/import/preview`, file),
      importXlsx: (setId, file) => upload(`/api/professor/sets/${setId}/exercises/import`, file),
    },
    bank: {
      list: (q) => get("/api/professor/bank", { ...q }),
      get: (id) => get(`/api/professor/bank/${id}`),
      create: (i) => request("POST", "/api/professor/bank", i),
      update: (id, i) => request("PATCH", `/api/professor/bank/${id}`, i),
      remove: (id) => request("DELETE", `/api/professor/bank/${id}`),
      copyToSet: (id, setId) => request("POST", `/api/professor/bank/${id}/copy`, { setId }),
    },
    feedback: {
      get: (setId) => get("/api/professor/feedback-templates", { setId }),
      save: (i) => request("PUT", "/api/professor/feedback-templates", i),
    },
    reviews: {
      list: (q) => get("/api/professor/feedback-reviews", { ...q, status: q?.status?.join(",") }),
      get: (id) => get(`/api/professor/feedback-reviews/${id}`),
      saveDraft: (id, finalText) =>
        request("PATCH", `/api/professor/feedback-reviews/${id}`, { finalText }),
      approve: (id, finalText) =>
        request("POST", `/api/professor/feedback-reviews/${id}/approve`, { finalText }),
      reject: (id, reason) =>
        request("POST", `/api/professor/feedback-reviews/${id}/reject`, { reason: reason ?? null }),
      regenerate: (id) => request("POST", `/api/professor/feedback-reviews/${id}/regenerate`),
    },
    results: {
      list: (q) => get("/api/professor/results", { ...q }),
      student: (id) => get(`/api/professor/results/students/${id}`),
      redoLevel: (studentId, setId, level) =>
        request("POST", `/api/professor/results/students/${studentId}/redo`, { setId, level }),
    },
    people: {
      students: () => get("/api/professor/students"),
      classrooms: () => get("/api/professor/classrooms"),
    },
  };
}
