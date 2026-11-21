import { apiMode, type StudentApi } from "./client";
import { httpApi } from "./http";
import { mockApi } from "./mock";

/** Swap mock/real with NEXT_PUBLIC_API_MODE=mock|http (default: mock). */
export const api: StudentApi = apiMode() === "http" ? httpApi : mockApi;

export * from "./types";
export type { StudentApi } from "./client";
