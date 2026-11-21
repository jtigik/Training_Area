import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { SpreadsheetGrid } from "./spreadsheet-grid";

function Harness({ onEdit = vi.fn() }: { onEdit?: (ref: string, text?: string) => void }) {
  const [selected, setSelected] = useState("A1");
  return (
    <SpreadsheetGrid
      rows={4}
      cols={2}
      display={{ A1: "10", A2: "20" }}
      editable={new Set(["A4"])}
      target="A4"
      selected={selected}
      onSelect={setSelected}
      onEdit={onEdit}
    />
  );
}

describe("SpreadsheetGrid", () => {
  it("renders an ARIA grid with A1 headers, testids and values", () => {
    render(<Harness />);
    const grid = screen.getByRole("grid", { name: "Planilha do exercício" });
    expect(grid).toHaveAttribute("aria-rowcount", "5");
    expect(screen.getByRole("columnheader", { name: "B" })).toBeInTheDocument();
    expect(screen.getByTestId("cell-A1")).toHaveTextContent("10");
    expect(screen.getByTestId("cell-A1")).toHaveAttribute("aria-readonly", "true");
    expect(screen.getByTestId("cell-A4")).not.toHaveAttribute("aria-readonly");
  });

  it("uses a roving tabindex and moves with the arrow keys", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const a1 = screen.getByTestId("cell-A1");
    expect(a1).toHaveAttribute("tabindex", "0");
    expect(screen.getByTestId("cell-B1")).toHaveAttribute("tabindex", "-1");
    a1.focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByTestId("cell-B1")).toHaveFocus();
    expect(screen.getByTestId("cell-B1")).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowRight}{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}");
    expect(screen.getByTestId("cell-B4")).toHaveFocus(); // clamped to the grid
    await user.keyboard("{Home}");
    expect(screen.getByTestId("cell-A4")).toHaveFocus();
  });

  it("starts editing only editable cells when typing", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<Harness onEdit={onEdit} />);
    screen.getByTestId("cell-A1").focus();
    await user.keyboard("=");
    expect(onEdit).not.toHaveBeenCalled();
    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}=");
    expect(onEdit).toHaveBeenCalledWith("A4", "=");
    await user.keyboard("{Enter}");
    expect(onEdit).toHaveBeenLastCalledWith("A4");
  });
});
