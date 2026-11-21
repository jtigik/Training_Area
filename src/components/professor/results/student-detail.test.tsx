import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StudentDetailPage } from "./student-detail";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));

vi.mock("@/lib/services", async (orig) => ({
  ...(await orig<typeof import("@/lib/services")>()),
  getServices: () => ({
    sets: { list: async () => [{ id: "set-1", name: "Trilha" }] },
    results: {
      student: async () => ({
        student: { id: "s1", name: "Ana", email: "ana@x.br" },
        attempts: [],
        progress: [
          {
            studentId: "s1",
            setId: "set-1",
            level: "FUNDAMENTAL",
            levelAttempt: 1,
            done: 5,
            correct: 2,
            required: 5,
            status: "COMPLETED",
            concept: "ND",
            bestConcept: "ND",
            completedAt: "2026-11-20T10:00:00.000Z",
            history: [],
          },
        ],
      }),
    },
  }),
}));

describe("StudentDetailPage", () => {
  it("professor pode liberar refazer (ND)", async () => {
    render(<StudentDetailPage id="s1" />);
    expect(await screen.findByTestId("redo-button")).toBeInTheDocument();
  });

  it("admin da instituição vê só leitura, sem refazer", async () => {
    render(<StudentDetailPage id="s1" readOnly basePath="/admin/resultados" />);
    expect(await screen.findByText(/Pode refazer o nível/)).toBeInTheDocument();
    expect(screen.queryByTestId("redo-button")).toBeNull();
    expect(screen.getByRole("link", { name: "Voltar aos resultados" })).toHaveAttribute(
      "href",
      "/admin/resultados",
    );
  });
});
