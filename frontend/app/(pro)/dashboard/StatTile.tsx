import type { LucideIcon } from "lucide-react";

export function StatTile({
  icon: Icon,
  label,
  value,
  unit,
  accent,
}: {
  icon: LucideIcon;
  label: string;
  /** Pre-formatted so callers can show a count ("3") or a currency string ("$1,240") alike. */
  value: string | number;
  unit?: string;
  /** Highlights tiles that call for action (pending requests) rather than just reporting a number. */
  accent?: boolean;
}) {
  const highlighted = accent && value !== 0 && value !== "0";

  return (
    <div
      className={
        highlighted
          ? "flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-3.5 shadow-card"
          : "flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3.5 shadow-card"
      }
    >
      <div
        className={
          highlighted
            ? "flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15"
            : "flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-50"
        }
      >
        <Icon className={highlighted ? "size-4.5 text-amber-700" : "size-4.5 text-brand-500"} />
      </div>
      <div>
        <p className="text-lg font-bold leading-tight text-brand">
          {value} {unit && <span className="text-sm font-normal text-muted-ink">{unit}{value === 1 ? "" : "s"}</span>}
        </p>
        <p className="text-xs text-muted-ink">{label}</p>
      </div>
    </div>
  );
}
