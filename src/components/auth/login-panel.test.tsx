import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
let search = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(search),
}));

import { LoginPanel } from "./login-panel";

describe("LoginPanel", () => {
  beforeEach(() => {
    replace.mockReset();
    search = "";
  });

  it("renders only the providers enabled in /api/login-options", async () => {
    const loginOptions = vi.fn().mockResolvedValue({
      providers: [{ id: "microsoft", label: "Microsoft" }],
      emailPassword: true,
      oauthMode: "native",
    });
    render(<LoginPanel startLogin={vi.fn()} loginOptions={loginOptions} />);
    expect(await screen.findByRole("button", { name: "Entrar com Microsoft" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: /Google/ })).not.toBeInTheDocument();
    // No e-mail/password form even when the backend enables it for dev/test.
    expect(screen.queryByLabelText(/senha/i)).not.toBeInTheDocument();
  });

  it("falls back to Google and Microsoft when the options cannot be loaded", async () => {
    const loginOptions = vi.fn().mockRejectedValue(new Error("offline"));
    render(<LoginPanel startLogin={vi.fn()} loginOptions={loginOptions} />);
    expect(await screen.findByRole("button", { name: "Entrar com Google" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Entrar com Microsoft" })).toBeInTheDocument();
  });

  it("passes callbackUrl through the OAuth round trip and redirects safely", async () => {
    search = "callbackUrl=%2Faluno%2Fconteudo";
    const startLogin = vi.fn().mockResolvedValue({
      kind: "signed-in",
      user: {
        id: "u",
        name: "Ana",
        email: "a@x",
        role: "ALUNO",
        tenantId: "t",
        tenant: { id: "t", name: "Inst", slug: "inst" },
      },
    });
    render(<LoginPanel startLogin={startLogin} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Entrar com Google" }));
    expect(startLogin).toHaveBeenCalledWith("google", "/login?callbackUrl=%2Faluno%2Fconteudo");
    expect(replace).toHaveBeenCalledWith("/aluno/conteudo");
  });

  it("accepts the legacy ?voltar= and ignores unsafe targets", async () => {
    search = "voltar=%2F%2Fevil.example";
    const startLogin = vi.fn().mockResolvedValue({
      kind: "signed-in",
      user: {
        id: "u",
        name: "Ana",
        email: "a@x",
        role: "ALUNO",
        tenantId: "t",
        tenant: { id: "t", name: "Inst", slug: "inst" },
      },
    });
    render(<LoginPanel startLogin={startLogin} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Entrar com Microsoft" }));
    expect(replace).toHaveBeenCalledWith("/aluno");
  });

  it("shows the dedicated message for ?error=ACCOUNT_NOT_REGISTERED in an alert", async () => {
    search = "error=ACCOUNT_NOT_REGISTERED&error_description=whatever";
    render(<LoginPanel startLogin={vi.fn()} />);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "Sua conta não está cadastrada nesta instituição. Fale com seu professor ou administrador.",
    );
    expect(alert).not.toHaveTextContent("whatever");
    expect(alert).toHaveFocus();
  });

  it("maps Better Auth codes and falls back to a generic message", async () => {
    search = "error=access_denied";
    const { unmount } = render(<LoginPanel startLogin={vi.fn()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/Login cancelado/);
    unmount();
    search = "error=SOMETHING_NEW";
    render(<LoginPanel startLogin={vi.fn()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível entrar. Tente novamente.",
    );
  });
});
