const TZ = "America/Sao_Paulo";

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: TZ }).format(
    new Date(iso),
  );
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: TZ }).format(d);
  const time = new Intl.DateTimeFormat("pt-BR", { timeStyle: "short", timeZone: TZ }).format(d);
  return `${date} às ${time} (horário de Brasília)`;
}

export function formatPercent(value: number, total: number): string {
  return total === 0 ? "0%" : `${Math.round((value / total) * 100)}%`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts.at(-1)![0] : "")).toUpperCase();
}
