"use client";

import {
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";

import { cn } from "@/lib/utils";

const LENGTH = 6;

type Props = {
  /** Chamado quando os 6 dígitos estão preenchidos. */
  onComplete: (code: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
  describedBy?: string;
};

/** 6 caixas para o código: aceita escrever, colar e o preenchimento automático do iOS. */
export function CodeInput({
  onComplete,
  disabled,
  invalid,
  autoFocus,
  describedBy,
}: Props) {
  const [digits, setDigits] = useState<string[]>(() => Array(LENGTH).fill(""));
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  function fill(start: number, raw: string) {
    const typed = raw.replace(/\D/g, "").slice(0, LENGTH - start);
    if (!typed) return;
    const next = [...digits];
    for (let i = 0; i < typed.length; i++) next[start + i] = typed[i] ?? "";
    setDigits(next);
    const last = Math.min(start + typed.length, LENGTH - 1);
    refs.current[last]?.focus();
    if (next.every(Boolean)) onComplete(next.join(""));
  }

  function onKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Backspace") return;
    e.preventDefault();
    const next = [...digits];
    if (next[index]) {
      next[index] = "";
    } else if (index > 0) {
      next[index - 1] = "";
      refs.current[index - 1]?.focus();
    }
    setDigits(next);
  }

  function onPaste(index: number, e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    // Um código colado ocupa sempre as 6 caixas, venha de onde vier o foco.
    const text = e.clipboardData.getData("text");
    fill(text.replace(/\D/g, "").length >= LENGTH ? 0 : index, text);
  }

  return (
    <div role="group" aria-label="Código de 6 dígitos" className="flex gap-2">
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={digit}
          onChange={(e) => {
            if (!e.target.value) {
              const next = [...digits];
              next[i] = "";
              setDigits(next);
            } else {
              fill(i, e.target.value);
            }
          }}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={(e) => onPaste(i, e)}
          onFocus={(e) => e.target.select()}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          autoFocus={autoFocus && i === 0}
          disabled={disabled}
          aria-label={`Dígito ${i + 1} de ${LENGTH}`}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn(
            "focus:shadow-foco h-16 min-w-0 flex-1 rounded-campo border-2 border-linha bg-branco text-center text-[28px] font-extrabold text-tinta outline-none focus:border-pinheiro disabled:opacity-60",
            invalid && "border-atraso bg-atraso-campo",
          )}
        />
      ))}
    </div>
  );
}
