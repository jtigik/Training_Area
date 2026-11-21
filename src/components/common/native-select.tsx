import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * <select> nativo com o visual dos inputs do shadcn/ui. Usado nos formulários
 * por ser acessível por padrão e funcionar bem com react-hook-form.
 */
export function NativeSelect({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        "border-input bg-background h-9 w-full min-w-0 rounded-md border px-3 py-1 text-sm shadow-xs outline-none",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:border-destructive disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
