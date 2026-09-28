import { format, isSameDay } from "date-fns";
import { Palmtree, Trash2 } from "lucide-react";

import type { TimeOff } from "./demo-data";

/** "Mon, Oct 12", or "Mon, Oct 12 – Sun, Oct 18" for more than one day. */
export function timeOffRange(off: TimeOff): string {
  return isSameDay(off.from, off.to)
    ? format(off.from, "EEE, MMM d")
    : `${format(off.from, "EEE, MMM d")} – ${format(off.to, "EEE, MMM d")}`;
}

/**
 * Heads a day that falls in time off. Above whatever is still on it rather than instead of it:
 * a job booked before the vacation was entered is still booked, and has to stay in sight.
 */
export function TimeOffBanner({ off, onRemove }: { off: TimeOff; onRemove?: (id: string) => void }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-dashed border-line bg-slate-50 px-3.5 py-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-slate-200/70">
        <Palmtree className="size-4 text-muted-ink" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">Time off{off.note && ` · ${off.note}`}</p>
        <p className="text-xs text-muted-ink">{timeOffRange(off)} · not bookable</p>
      </div>
      {onRemove && (
        <button
          type="button"
          onClick={() => onRemove(off.id)}
          aria-label={`Remove time off, ${timeOffRange(off)}`}
          className="grid size-8 shrink-0 place-items-center rounded-full text-faint hover:bg-destructive/5 hover:text-destructive"
        >
          <Trash2 className="size-4" />
        </button>
      )}
    </div>
  );
}
