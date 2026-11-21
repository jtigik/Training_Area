"use client";

import type { KeyboardEvent, RefObject } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface FormulaBarProps {
  cell: string;
  value: string;
  readOnly: boolean;
  onChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  inputRef?: RefObject<HTMLInputElement | null>;
  helpId: string;
}

/** Name box + formula input ("fx"), as in Excel. Enter = calcular, Esc = cancelar. */
export function FormulaBar({
  cell,
  value,
  readOnly,
  onChange,
  onCommit,
  onCancel,
  inputRef,
  helpId,
}: FormulaBarProps) {
  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!readOnly) onCommit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border bg-card p-2 sm:flex-nowrap">
      <label htmlFor="caixa-nome" className="sr-only">
        Célula selecionada
      </label>
      <input
        id="caixa-nome"
        value={cell}
        readOnly
        className="h-8 w-16 rounded-md border border-input bg-muted px-2 text-center font-formula text-sm"
      />
      <span
        aria-hidden="true"
        className="font-formula text-sm font-semibold text-muted-foreground italic"
      >
        fx
      </span>
      <label htmlFor="barra-formula" className="sr-only">
        {`Fórmula ou valor da célula ${cell}${readOnly ? " (bloqueada)" : ""}`}
      </label>
      <input
        id="barra-formula"
        ref={inputRef}
        value={value}
        readOnly={readOnly}
        aria-describedby={helpId}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={readOnly ? "" : "=SOMA(A1:A3)"}
        className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 font-formula text-sm read-only:bg-muted read-only:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Cancelar edição (Esc)"
        onClick={onCancel}
        disabled={readOnly}
      >
        <X aria-hidden="true" />
      </Button>
      <Button type="button" variant="secondary" onClick={onCommit} disabled={readOnly}>
        Calcular <span className="hidden text-muted-foreground sm:inline">(Enter)</span>
      </Button>
    </div>
  );
}
