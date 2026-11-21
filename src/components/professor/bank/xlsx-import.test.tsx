import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { XlsxImport } from "./xlsx-import";

const previewImport = vi.fn();
const importXlsx = vi.fn();

vi.mock("@/lib/services", async (orig) => ({
  ...(await orig<typeof import("@/lib/services")>()),
  getServices: () => ({
    sets: { list: async () => [{ id: "set-1", name: "Trilha" }] },
    exercises: { previewImport, importXlsx },
  }),
}));

const draft = {
  title: "e2e — Soma importada",
  statement: "S",
  level: "FUNDAMENTAL",
  difficulty: "VERY_EASY",
  hint: null,
  grid: { rows: 3, cols: 2, cells: { A1: { value: 46347, locked: true } } },
  answers: { B1: { kind: "FORMULA", expected: { f: "=A1+1" } } },
  dateCells: ["A1"],
};
const xlsx = () =>
  new File(["PK"], "a.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

async function pick() {
  render(<XlsxImport defaultSetId="set-1" />);
  fireEvent.change(screen.getByTestId("xlsx-import-input"), { target: { files: [xlsx()] } });
  return screen.findByRole("button", { name: "Confirmar importação" });
}

beforeEach(() => {
  previewImport.mockReset();
  importXlsx.mockReset();
});

describe("XlsxImport: pré-visualizar → confirmar/cancelar", () => {
  it("pré-visualiza sem gravar, exibe datas e confirma", async () => {
    previewImport.mockResolvedValue({ drafts: [draft], errors: [] });
    importXlsx.mockResolvedValue({ created: [] });
    const confirm = await pick();
    expect(importXlsx).not.toHaveBeenCalled();
    expect(screen.getByTestId("import-result")).toHaveTextContent("e2e — Soma importada");
    expect(screen.getByTestId("import-result")).toHaveTextContent("21/11/2026");
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    await waitFor(() => expect(importXlsx).toHaveBeenCalledWith("set-1", expect.any(File)));
  });

  it("com erros, Confirmar fica desabilitado e lista aba/linha", async () => {
    previewImport.mockResolvedValue({
      drafts: [],
      errors: [
        {
          sheet: "Gabarito (2)",
          row: 3,
          column: "B",
          cell: "B3",
          code: "MISSING_ANSWER",
          message: "informe a resposta",
        },
      ],
    });
    const confirm = await pick();
    expect(confirm).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("Aba Gabarito (2), linha 3");
  });

  it("Cancelar descarta a pré-visualização sem importar", async () => {
    previewImport.mockResolvedValue({ drafts: [draft], errors: [] });
    await pick();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("button", { name: "Confirmar importação" })).toBeNull();
    expect(importXlsx).not.toHaveBeenCalled();
  });
});
