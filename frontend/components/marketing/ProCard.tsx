import { format, isSameDay } from "date-fns";
import { ArrowRight, BadgeCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Pro } from "@/components/marketing/pros-data";

const today = new Date(new Date().setHours(0, 0, 0, 0));

// Shared between the homepage's availability rail and the /browse grid, so
// the card's design only has to be maintained in one place. `className`
// lets each caller own sizing (fixed-width + snap for the rail, full-width
// for the grid) without touching the card's own visual styling.
export function ProCard({ pro, className }: { pro: Pro; className?: string }) {
  return (
    <Card
      className={cn(
        "flex flex-col gap-0 rounded-3xl border border-line bg-white p-5 shadow-card ring-0 transition-all duration-200 hover:-translate-y-1 hover:border-brand-100 hover:shadow-lift",
        className
      )}
    >
      {/*
        min-h-16: reserves room for a two-line business name (e.g. "Gutierrez
        General Contracting") even when a pro's name fits on one line, so
        the trade badge and everything under it always starts at the same
        height across cards instead of shifting up for the shorter ones.
      */}
      <div className="mb-4 flex min-h-16 items-center gap-3">
        <div
          className="grid size-[46px] shrink-0 place-items-center rounded-full text-base font-bold tracking-[-0.02em] text-white"
          style={{ background: pro.color }}
        >
          {pro.initials}
        </div>
        <div>
          <p className="m-0 text-[16.5px] font-bold leading-tight tracking-[-0.02em]">{pro.name}</p>
          <p className="m-0 text-[13.5px] text-muted-ink">{pro.business}</p>
        </div>
      </div>

      <Badge className="mb-3.5 h-auto w-fit self-start rounded-full border-transparent bg-brand-50 px-3 py-1 text-[11.5px] font-semibold text-brand-500">
        {pro.trade}
      </Badge>

      <div className="flex items-center gap-2.5 text-[13.5px] text-muted-ink">
        <span>★ <strong className="font-semibold text-brand">{pro.rating.toFixed(1)}</strong></span>
        <span className="text-[#CBD6E2]">•</span>
        <span>{pro.jobs} jobs</span>
        <span className="text-[#CBD6E2]">•</span>
        <span>{pro.miles} mi</span>
      </div>

      <div className="mb-3.5 mt-2 flex items-center gap-3 border-b border-line pb-3.5 text-[12px] font-medium text-muted-ink">
        <span className="inline-flex items-center gap-1">
          <BadgeCheck className="size-3.5 text-go" />
          Licensed
        </span>
        {pro.verified && (
          <span className="inline-flex items-center gap-1">
            <BadgeCheck className="size-3.5 text-go" />
            Identity verified
          </span>
        )}
      </div>

      <p className="mb-2 text-xs font-semibold text-faint">
        From <span className="font-bold text-brand">${pro.rateFrom}</span>/hr · Next available
      </p>
      {/*
        flex-col, not flex-wrap: with wrap, whether a row held one button or
        two depended on how wide that particular pro's time labels happened
        to be ("Tue 10:30 AM" vs "3:00 PM"), so slot 1/2/3 landed at
        different heights on different cards. flex-col forces one slot per
        row unconditionally, so slot 1 is always row 1 across every card.
        min-h reserves a full 3-row card (the max any pro lists — sliced
        below as a safety cap) even when a pro only has 1 or 2, so every
        card ends the same height either way.
      */}
      <div className="mt-auto flex min-h-[116px] flex-col gap-1.5">
        {pro.slots.slice(0, 3).map((s) => {
          const sameDay = isSameDay(s.date, today);
          const label = sameDay ? s.time : `${format(s.date, "EEE")} ${s.time}`;
          return (
            <Button
              key={s.date.toISOString() + s.time}
              variant="outline"
              className={
                sameDay
                  ? "h-auto rounded-[10px] border-[#BFEBD8] bg-go-bg px-2.5 py-2 font-mono text-[12.5px] font-medium text-[#07734F] hover:border-go hover:bg-go hover:text-white"
                  : "h-auto rounded-[10px] border-line bg-white px-2.5 py-2 font-mono text-[12.5px] font-medium text-brand hover:border-brand hover:bg-brand hover:text-white"
              }
            >
              Book {label}
              <ArrowRight className="ml-0.5 size-3 opacity-0 transition-opacity duration-150 group-hover/button:opacity-100" />
            </Button>
          );
        })}
      </div>
    </Card>
  );
}
