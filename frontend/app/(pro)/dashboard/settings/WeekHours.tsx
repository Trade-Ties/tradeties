import { DAYS_OF_WEEK, dayName, formatTime } from "@/components/profile/time";
import type { WorkingHours } from "@/lib/api/wire";

/**
 * The working week as a timetable: the day, then each stretch of work on its own line, in
 * columns that run the length of the week — start times under start times, dashes under dashes,
 * end times under end times — so a split day and a plain one line up with each other.
 *
 * One grid for the whole week, and each day a subgrid of it: columns sized per day would line up
 * the two shifts of a Monday and nothing else.
 */
export function WeekHours({ hours }: { hours: WorkingHours }) {
  return (
    <dl className="grid grid-cols-[1fr_auto_auto_auto] gap-x-2 text-sm">
      {DAYS_OF_WEEK.map((dow) => {
        const blocks = hours.days.find((d) => d.dayOfWeek === dow)?.blocks ?? [];

        return (
          <div
            key={dow}
            className="col-span-4 grid grid-cols-subgrid gap-y-1 border-b border-line py-2 last:border-0"
          >
            <dt className="text-muted-ink" style={{ gridRow: `span ${Math.max(blocks.length, 1)}` }}>
              {dayName(dow)}
            </dt>
            <dd className="col-span-3 grid grid-cols-subgrid gap-y-1">
              {blocks.length === 0 ? (
                <span className="col-span-3 text-right text-faint">Closed</span>
              ) : (
                blocks.map((b) => (
                  <span key={b.startsAt} className="col-span-3 grid grid-cols-subgrid font-medium tabular-nums">
                    <span className="text-right">{formatTime(b.startsAt)}</span>
                    <span className="text-faint">–</span>
                    <span className="text-right">{formatTime(b.endsAt)}</span>
                  </span>
                ))
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
