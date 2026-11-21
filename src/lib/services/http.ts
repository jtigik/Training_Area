import { ApiError, type ApiErrorBody, type Services } from "./contracts";

type Query = Record<string, string | number | boolean | undefined | null>;

function qs(query?: Query): string {
  if (!query) return "";
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(query))
    if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: "include",
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let err: ApiErrorBody = { code: "erro_http", message: res.statusText };
    try {
      err = (await res.json()) as ApiErrorBody;
    } catch {
      /* corpo vazio */
    }
    throw new ApiError(res.status, err.code, err.message, err.details);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

/** Envio multipart do .xlsx; converte o 422 do BE2 `{ error: { code }, errors }` em ApiError. */
async function upload<T>(path: string, file: File): Promise<T> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(path, { method: "POST", credentials: "include", body: form });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const b = (body ?? {}) as {
      error?: { code?: string; message?: string };
      errors?: unknown;
      code?: string;
      message?: string;
    };
    const code = b.error?.code ?? b.code ?? "erro_http";
    const message =
      b.error?.message ??
      b.message ??
      (code === "IMPORT_INVALID" ? "A planilha tem erros; nada foi importado." : res.statusText);
    throw new ApiError(res.status, code, message, { errors: b.errors ?? [] });
  }
  return body as T;
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
      create: (i) => request("POST", "/api/admin/users", i),
      update: (id, i) => request("PATCH", `/api/admin/users/${id}`, i),
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
      listBySet: (setId) => get(`/api/professor/sets/${setId}/exercises`),
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
