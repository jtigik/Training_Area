import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LEVELS, Welcome } from "./welcome";

describe("Welcome", () => {
  it("exibe o título e os níveis de conhecimento", () => {
    render(<Welcome />);

    expect(screen.getByRole("heading", { level: 1, name: "Training Area" })).toBeInTheDocument();
    const items = screen.getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual([...LEVELS]);
  });
});
