"use client";

import { useLayoutEffect, useRef, type ComponentProps, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

interface EditableCellProps extends Omit<ComponentProps<"div">, "onChange" | "children"> {
  value: string;
  onValueChange: (value: string) => void;
  onNavigate?: (key: string) => void;
}

/**
 * Célula editável (contenteditable em texto puro). Mantém o texto como conteúdo do
 * elemento — leitores de tela e testes leem o valor como texto, como numa planilha.
 */
export function EditableCell({
  value,
  onValueChange,
  onNavigate,
  className,
  onKeyDown,
  ...props
}: EditableCellProps) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (el && el.textContent !== value && document.activeElement !== el) el.textContent = value;
  }, [value]);

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    if (e.key === "Enter" || e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "Tab") {
      if (e.key === "Tab") return;
      e.preventDefault();
      onNavigate?.(e.key === "Enter" ? (e.shiftKey ? "ArrowUp" : "ArrowDown") : e.key);
    }
  }

  return (
    <div
      ref={ref}
      role="textbox"
      tabIndex={0}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      className={cn(
        "h-full w-full overflow-hidden px-1.5 text-sm leading-[var(--spacing-grid-row,2rem)] whitespace-nowrap outline-none",
        className,
      )}
      onInput={(e) => onValueChange(e.currentTarget.textContent ?? "")}
      onBlur={(e) => {
        const text = e.currentTarget.textContent ?? "";
        if (text !== value) onValueChange(text);
      }}
      onPaste={(e) => {
        e.preventDefault();
        const text = e.clipboardData.getData("text/plain").replace(/\r?\n/g, " ");
        document.execCommand?.("insertText", false, text);
      }}
      onKeyDown={handleKeyDown}
      {...props}
    />
  );
}
