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

/** Implementação real (fetch) seguindo os endpoints documentados em `contracts.ts`. */
export function createHttpServices(): Services {
  const get = <T>(p: string, q?: Query) => request<T>("GET", p + qs(q));
  return {
    users: {
      list: (q) => get("/api/admin/users", { ...q }),
      create: (i) => request("POST", "/api/admin/users", i),
      update: (id, i) => request("PATCH", `/api/admin/users/${id}`, i),
    },
    instance: {
      get: () => get("/api/admin/config"),
      update: (i) => request("PUT", "/api/admin/config", i),
    },
    sections: {
      list: () => get("/api/teacher/sections"),
      get: (id) => get(`/api/teacher/sections/${id}`),
      create: (i) => request("POST", "/api/teacher/sections", i),
      update: (id, i) => request("PATCH", `/api/teacher/sections/${id}`, i),
      setStatus: (id, status) => request("POST", `/api/teacher/sections/${id}/status`, { status }),
      reorder: (ids) => request("PUT", "/api/teacher/sections/order", { ids }),
      remove: (id) => request("DELETE", `/api/teacher/sections/${id}`),
    },
    sets: {
      list: () => get("/api/teacher/sets"),
      get: (id) => get(`/api/teacher/sets/${id}`),
      create: (i) => request("POST", "/api/teacher/sets", i),
      update: (id, i) => request("PATCH", `/api/teacher/sets/${id}`, i),
      publish: (id) => request("POST", `/api/teacher/sets/${id}/publish`),
      unpublish: (id) => request("POST", `/api/teacher/sets/${id}/unpublish`),
    },
    exercises: {
      listBySet: (setId) => get(`/api/teacher/sets/${setId}/exercises`),
      get: (id) => get(`/api/teacher/exercises/${id}`),
      create: (setId, i) => request("POST", `/api/teacher/sets/${setId}/exercises`, i),
      update: (id, i) => request("PATCH", `/api/teacher/exercises/${id}`, i),
      remove: (id) => request("DELETE", `/api/teacher/exercises/${id}`),
    },
    feedback: {
      get: (setId) => get("/api/teacher/feedback-templates", { setId }),
      save: (i) => request("PUT", "/api/teacher/feedback-templates", i),
    },
    results: {
      list: (q) => get("/api/teacher/results", { ...q }),
      student: (id) => get(`/api/teacher/results/students/${id}`),
    },
    people: {
      students: () => get("/api/teacher/students"),
      classrooms: () => get("/api/teacher/classrooms"),
    },
  };
}
