import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export function StatTile({
  icon: Icon,
  label,
  value,
  unit,
  accent,
  href,
}: {
  icon: LucideIcon;
  label: string;
  /** Pre-formatted so callers can show a count ("3") or a currency string ("$1,240") alike. */
  value: string | number;
  unit?: string;
  /** Highlights tiles that call for action (pending requests) rather than just reporting a number. */
  accent?: boolean;
  /** Where the things the number counts are listed. The whole tile becomes the link. */
  href?: string;
}) {
  const highlighted = accent && value !== 0 && value !== "0";

  const className = cn(
    "flex items-center gap-3 rounded-2xl border px-4 py-3.5 shadow-card",
    highlighted ? "border-amber-500/30 bg-amber-500/5" : "border-line bg-white",
    href &&
      (highlighted
        ? "group transition-colors hover:border-amber-500/50 hover:bg-amber-500/10"
        : "group transition-colors hover:border-brand-100 hover:bg-brand-50/60")
  );

  const content = (
    <>
      <div
        className={
          highlighted
            ? "flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15"
            : "flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-50"
        }
      >
        <Icon className={highlighted ? "size-4.5 text-amber-700" : "size-4.5 text-brand-500"} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-lg font-bold leading-tight text-brand">
          {value} {unit && <span className="text-sm font-normal text-muted-ink">{unit}{value === 1 ? "" : "s"}</span>}
        </p>
        <p className="text-xs text-muted-ink">{label}</p>
      </div>
      {href && (
        <ChevronRight className="size-4 shrink-0 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-brand-500" />
      )}
    </>
  );

  return href ? (
    <Link href={href} className={className}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}
