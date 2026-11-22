import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CodeInput } from "./code-input";

const boxes = () => screen.getAllByRole("textbox");

describe("CodeInput", () => {
  it("tem 6 caixas numéricas e o preenchimento automático na primeira", () => {
    render(<CodeInput onComplete={() => {}} />);
    expect(boxes()).toHaveLength(6);
    boxes().forEach((box) =>
      expect(box).toHaveAttribute("inputmode", "numeric"),
    );
    expect(boxes()[0]).toHaveAttribute("autocomplete", "one-time-code");
  });

  it("entra sozinho ao colar o código completo", async () => {
    const onComplete = vi.fn();
    const user = userEvent.setup();
    render(<CodeInput onComplete={onComplete} />);

    await user.click(boxes()[0]!);
    await user.paste("123456");

    expect(onComplete).toHaveBeenCalledExactlyOnceWith("123456");
    expect(boxes().map((b) => (b as HTMLInputElement).value)).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
    ]);
  });

  it("cola o código inteiro mesmo com o foco noutra caixa e ignora espaços", async () => {
    const onComplete = vi.fn();
    const user = userEvent.setup();
    render(<CodeInput onComplete={onComplete} />);

    await user.click(boxes()[3]!);
    await user.paste("123 456");

    expect(onComplete).toHaveBeenCalledExactlyOnceWith("123456");
  });

  it("avança de caixa ao escrever e só submete no sexto dígito", async () => {
    const onComplete = vi.fn();
    const user = userEvent.setup();
    render(<CodeInput onComplete={onComplete} />);

    await user.click(boxes()[0]!);
    await user.keyboard("12345");
    expect(onComplete).not.toHaveBeenCalled();
    await user.keyboard("6");

    expect(onComplete).toHaveBeenCalledExactlyOnceWith("123456");
  });

  it("ignora letras", async () => {
    const onComplete = vi.fn();
    const user = userEvent.setup();
    render(<CodeInput onComplete={onComplete} />);

    await user.click(boxes()[0]!);
    await user.keyboard("ab12");

    expect(boxes().map((b) => (b as HTMLInputElement).value)).toEqual([
      "1",
      "2",
      "",
      "",
      "",
      "",
    ]);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("Backspace apaga e recua", async () => {
    const user = userEvent.setup();
    render(<CodeInput onComplete={() => {}} />);

    await user.click(boxes()[0]!);
    await user.keyboard("12{Backspace}{Backspace}");

    expect(boxes().map((b) => (b as HTMLInputElement).value)).toEqual([
      "",
      "",
      "",
      "",
      "",
      "",
    ]);
  });

  it("marca o erro", () => {
    render(<CodeInput onComplete={() => {}} invalid />);
    boxes().forEach((box) =>
      expect(box).toHaveAttribute("aria-invalid", "true"),
    );
  });
});
