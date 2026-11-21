import type { Services } from "./contracts";
import { createHttpServices } from "./http";
import { createMockServices } from "./mock";

export * from "./contracts";

let instance: Services | null = null;

/**
 * Ponto único de acesso aos serviços. `NEXT_PUBLIC_API_MODE=http` usa as APIs
 * reais; qualquer outro valor (padrão) usa o mock em memória.
 */
export function getServices(): Services {
  if (!instance) {
    instance =
      process.env.NEXT_PUBLIC_API_MODE === "http"
        ? createHttpServices()
        : createMockServices({ latency: 250 });
  }
  return instance;
}

/** Só para testes. */
export function setServices(services: Services | null) {
  instance = services;
}
