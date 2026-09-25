import { format } from "date-fns";
import { Lock, Trash2 } from "lucide-react";

import type { CalendarEntry } from "./demo-data";

/**
 * One of the tradesperson's own entries in an agenda list. Set apart from appointments — grey,
 * no customer, no confirm — because it is not a job, only time nobody can book.
 */
export function EntryRow({
  entry,
  onRemove,
  showDate,
}: {
  entry: CalendarEntry;
  /** Left out where the list is only a preview and nothing is edited. */
  onRemove?: (id: string) => void;
  showDate?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-dashed border-line bg-slate-50 px-3.5 py-3">
      <div className="w-[74px] shrink-0 text-sm font-semibold text-muted-ink">
        {showDate && <span className="block text-[11px] font-medium">{format(entry.start, "EEE, MMM d")}</span>}
        {format(entry.start, "h:mm a")}
        <span className="block text-[11px] font-normal text-faint">to {format(entry.end, "h:mm a")}</span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-foreground">{entry.title}</p>
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-slate-200/70 px-2 py-0.5 text-[11px] font-semibold text-muted-ink">
            <Lock className="size-2.5" />
            Blocked
          </span>
        </div>
        {entry.notes && <p className="truncate text-xs text-muted-ink">{entry.notes}</p>}
      </div>

      {onRemove && (
        <button
          type="button"
          onClick={() => onRemove(entry.id)}
          aria-label={`Remove ${entry.title}`}
          className="grid size-8 shrink-0 place-items-center rounded-full text-faint hover:bg-destructive/5 hover:text-destructive"
        >
          <Trash2 className="size-4" />
        </button>
      )}
    </div>
  );
}
