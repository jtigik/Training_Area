import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CheckboxFieldProps extends Omit<ComponentProps<"input">, "type"> {
  label: ReactNode;
}

/** Checkbox nativo com rótulo clicável (acessível por teclado). */
export function CheckboxField({ label, className, ...props }: CheckboxFieldProps) {
  return (
    <label className={cn("inline-flex cursor-pointer items-center gap-2 text-sm", className)}>
      <input type="checkbox" className="accent-primary size-4 rounded" {...props} />
      <span>{label}</span>
    </label>
  );
}
