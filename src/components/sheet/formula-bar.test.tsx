import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { FormulaBar } from "./formula-bar";

function Harness(props: { readOnly?: boolean; onCommit?: () => void; onCancel?: () => void }) {
  const [value, setValue] = useState("");
  return (
    <FormulaBar
      cell="A4"
      value={value}
      readOnly={props.readOnly ?? false}
      onChange={setValue}
      onCommit={props.onCommit ?? vi.fn()}
      onCancel={props.onCancel ?? vi.fn()}
      helpId="ajuda"
    />
  );
}

describe("FormulaBar", () => {
  it("labels the input with the selected cell and commits on Enter", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    const input = screen.getByRole("textbox", { name: "Fórmula ou valor da célula A4" });
    expect(screen.getByRole("textbox", { name: "Célula selecionada" })).toHaveValue("A4");
    await user.type(input, "=SOMA(A1:A3){Enter}");
    expect(input).toHaveValue("=SOMA(A1:A3)");
    expect(onCommit).toHaveBeenCalledOnce();
  });

  it("cancels on Escape", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<Harness onCancel={onCancel} />);
    await user.type(screen.getByRole("textbox", { name: /Fórmula/ }), "=1{Escape}");
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("is read-only for locked cells and never commits", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<Harness readOnly onCommit={onCommit} />);
    const input = screen.getByRole("textbox", { name: /\(bloqueada\)/ });
    expect(input).toHaveAttribute("readonly");
    await user.type(input, "x{Enter}");
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Cancelar/ })).toBeDisabled();
  });
});
