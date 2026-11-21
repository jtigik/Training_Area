import { useId, type ReactElement, type ReactNode, cloneElement } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FieldProps {
  label: ReactNode;
  /** Mensagem de erro; liga aria-invalid e aria-describedby no controle. */
  error?: string;
  description?: ReactNode;
  required?: boolean;
  className?: string;
  /** Um único controle (input, textarea, select) que receberá id e atributos ARIA. */
  children: ReactElement<Record<string, unknown>>;
}

/** Campo de formulário acessível: rótulo, descrição e erro ligados ao controle. */
export function Field({ label, error, description, required, className, children }: FieldProps) {
  const id = useId();
  const descId = description ? `${id}-desc` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [descId, errId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {required ? (
          <span aria-hidden="true" className="text-destructive">
            *
          </span>
        ) : null}
      </Label>
      {cloneElement(children, {
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy,
        "aria-required": required || undefined,
      })}
      {description ? (
        <p id={descId} className="text-muted-foreground text-xs">
          {description}
        </p>
      ) : null}
      {error ? (
        <p id={errId} className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
