import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TabBar } from "./tab-bar";

const pathname = vi.hoisted(() => ({ value: "/" }));
vi.mock("next/navigation", () => ({
  usePathname: () => pathname.value,
  useRouter: () => ({ back: vi.fn() }),
}));

describe("TabBar", () => {
  beforeEach(() => {
    pathname.value = "/";
  });

  it("mostra os quatro separadores e o botão +", () => {
    render(<TabBar />);
    for (const name of ["Hoje", "Animais", "Despesas", "Perfil"]) {
      expect(screen.getByRole("link", { name })).toBeInTheDocument();
    }
    expect(
      screen.getByRole("button", { name: "Registar" }),
    ).toBeInTheDocument();
  });

  it.each([
    ["/", "Hoje"],
    ["/animais", "Animais"],
    ["/despesas", "Despesas"],
    ["/perfil", "Perfil"],
  ])("em %s só «%s» fica ativo", (path, active) => {
    pathname.value = path;
    render(<TabBar />);
    const current = screen
      .getAllByRole("link")
      .filter((l) => l.getAttribute("aria-current") === "page");
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAccessibleName(active);
  });

  it("subpáginas mantêm o separador ativo; /registar não ativa nenhum", () => {
    pathname.value = "/animais/123";
    const { unmount } = render(<TabBar />);
    expect(screen.getByRole("link", { name: "Animais" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    unmount();
    pathname.value = "/registar/despesa";
    const second = render(<TabBar />);
    expect(
      screen.getAllByRole("link").some((l) => l.hasAttribute("aria-current")),
    ).toBe(false);
    second.unmount();
  });

  it.each(["consulta", "tratamento", "peso"])(
    "o registo de %s esconde a barra (tem a sua barra de ação)",
    (r) => {
      pathname.value = `/registar/${r}`;
      render(<TabBar />);
      expect(screen.queryByRole("navigation")).toBeNull();
    },
  );
});

describe("Painel do +", () => {
  it("abre com as cinco ações e fecha com Esc e com «Fechar»", async () => {
    const user = userEvent.setup();
    pathname.value = "/";
    render(<TabBar />);
    expect(screen.queryByRole("dialog")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Registar" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveAccessibleName("O que queres registar?");
    for (const title of [
      "Consulta",
      "Tratamento",
      "Peso",
      "Despesa",
      "Documento",
    ]) {
      expect(
        screen.getByRole("link", { name: new RegExp(`^${title}\\.`) }),
      ).toBeTruthy();
    }
    expect(
      screen.getByRole("link", {
        name: /^Consulta\. Vacinas, medicação, peso e custo de uma só vez$/,
      }),
    ).toHaveAttribute("href", "/registar/consulta");

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Registar" }));
    await screen.findByRole("dialog");
    await user.click(screen.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
