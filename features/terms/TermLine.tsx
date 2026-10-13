import type { LocalDate } from "@/lib/domain/dates";
import type { TermStatus } from "@/lib/domain/terms";
import { describeStatus } from "@/lib/domain/terms";
import { formatShortDate } from "@/lib/format";

/** Kolorowa kropka + opis terminu: „12 lis · za 30 dni”. */
export function StatusDot({ status }: { status: TermStatus }) {
  const color = status.state === "overdue" ? "bg-danger" : status.state === "soon" ? "bg-warn" : "bg-accent";
  const label = status.state === "overdue" ? "Po terminie" : status.state === "soon" ? "Niedługo" : "W porządku";
  return <span role="img" aria-label={label} className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${color}`} />;
}

export function statusText(dueOn: LocalDate | null, status: TermStatus, today: LocalDate): string {
  const desc = describeStatus(status);
  return [dueOn ? formatShortDate(dueOn, today) : null, desc || null].filter(Boolean).join(" · ") || "bez daty";
}

export function statusTone(status: TermStatus): string {
  return status.state === "overdue" ? "text-danger font-semibold" : status.state === "soon" ? "text-warn-text font-semibold" : "text-muted";
}
