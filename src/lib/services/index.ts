import type { Services } from "./contracts";
import { createHttpServices } from "./http";
import { createMockServices } from "./mock";
import { createSeed, MOCK_DB_VERSION, type MockDb } from "./mock/seed";

export * from "./contracts";

const STORAGE_KEY = "training-area:mock-db";
let instance: Services | null = null;

function loadDb(): MockDb {
  if (typeof window === "undefined") return createSeed();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as MockDb) : null;
    if (parsed?.version === MOCK_DB_VERSION) return parsed;
  } catch {
    /* armazenamento indisponível ou corrompido: recomeça do seed */
  }
  return createSeed();
}

function saveDb(db: MockDb) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    /* cota cheia / modo privado: segue só em memória */
  }
}

/** Apaga os dados simulados (volta ao seed). */
export function resetMockData() {
  if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
  instance = null;
}

export const isMockMode = () => process.env.NEXT_PUBLIC_API_MODE !== "http";

/**
 * Ponto único de acesso aos serviços. `NEXT_PUBLIC_API_MODE=http` usa as APIs
 * reais; qualquer outro valor (padrão) usa o mock, persistido em localStorage
 * para sobreviver a recarregamentos.
 */
export function getServices(): Services {
  if (!instance) {
    instance = isMockMode()
      ? createMockServices({ latency: 80, db: loadDb(), persist: saveDb })
      : createHttpServices();
  }
  return instance;
}

/** Só para testes. */
export function setServices(services: Services | null) {
  instance = services;
}
