import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { createEmptyGrid } from "@/lib/domain/grid";
import { GridEditor, type GridEditorValue } from "./grid-editor";

let latest: GridEditorValue;

function Harness() {
  const [value, setValue] = useState<GridEditorValue>({ grid: createEmptyGrid(3, 3), answers: {} });
  return (
    <GridEditor
      {...value}
      onChange={(next) => {
        latest = next;
        setValue(next);
      }}
    />
  );
}

function typeInCell(testId: string, text: string) {
  const el = screen.getByTestId(testId);
  el.textContent = text;
  fireEvent.input(el);
  fireEvent.blur(el);
}

describe("GridEditor: tipos das células", () => {
  it("guarda 10 como número, '10 como texto, TRUE como lógico e =... como fórmula", () => {
    render(<Harness />);
    typeInCell("cell-A1", "10");
    typeInCell("cell-A2", "'10");
    typeInCell("cell-A3", "true");
    typeInCell("cell-B1", "=A1*2");
    typeInCell("cell-B2", "'=texto");
    expect(latest.grid.cells.A1.value).toBe(10);
    expect(latest.grid.cells.A2.value).toBe("10");
    expect(latest.grid.cells.A3.value).toBe(true);
    expect(latest.grid.cells.B1.value).toEqual({ f: "=A1*2" });
    expect(latest.grid.cells.B2.value).toBe("=texto");
    expect(screen.getByTestId("cell-A2")).toHaveTextContent("'10");
    expect(screen.getByTestId("cell-A3")).toHaveTextContent("TRUE");
  });

  it("gabarito: rascunho local e valor tipado", () => {
    render(<Harness />);
    const input = screen.getByTestId("answer-cell-C3");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "'" } });
    expect(input).toHaveValue("'");
    fireEvent.change(input, { target: { value: "'60" } });
    expect(latest.answers.C3).toEqual({ kind: "VALUE", expected: "60", tolerance: 0 });
    fireEvent.change(input, { target: { value: "60" } });
    expect(latest.answers.C3.expected).toBe(60);
    fireEvent.change(input, { target: { value: "=SOMA(A1:A3)" } });
    fireEvent.blur(input);
    expect(latest.answers.C3).toEqual({ kind: "FORMULA", expected: { f: "=SOMA(A1:A3)" } });
    expect(input).toHaveValue("=SOMA(A1:A3)");
  });
});
