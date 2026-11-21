import { cn } from "@/lib/utils";

/** Accessible progress bar (role=progressbar with "N de M" value text). */
export function ProgressBar({
  label,
  value,
  max,
  className,
  barClassName,
}: {
  label: string;
  value: number;
  max: number;
  className?: string;
  barClassName?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={`${value} de ${max}`}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      <div
        className={cn("h-full rounded-full bg-primary", barClassName)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
