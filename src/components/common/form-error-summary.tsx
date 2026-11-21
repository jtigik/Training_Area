import type { FieldErrors, FieldValues } from "react-hook-form";

/** Achata os erros do react-hook-form em mensagens únicas (inclui arrays e erros de raiz). */
export function collectErrorMessages(errors: FieldErrors<FieldValues> | undefined): string[] {
  const out: string[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const rec = node as Record<string, unknown>;
    if (typeof rec.message === "string" && rec.message) out.push(rec.message);
    for (const [key, value] of Object.entries(rec)) {
      if (key === "ref" || key === "message" || key === "type" || key === "types") continue;
      walk(value);
    }
  };
  walk(errors);
  return [...new Set(out)];
}

/**
 * Resumo de erros do formulário: um único `role="alert"` por formulário,
 * anunciado a leitores de tela quando a validação falha.
 */
export function FormErrorSummary({
  messages,
  title = "Corrija os campos abaixo:",
}: {
  messages: string[];
  title?: string;
}) {
  if (messages.length === 0) return null;
  return (
    <div
      role="alert"
      className="border-destructive/40 bg-destructive/5 text-destructive rounded-md border p-3 text-sm"
    >
      <p className="font-medium">{title}</p>
      <ul className="mt-1 list-disc pl-5">
        {messages.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
    </div>
  );
}
