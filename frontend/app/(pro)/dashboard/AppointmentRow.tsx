import { format } from "date-fns";
import { Check, MapPin, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DemoAppointment } from "./demo-data";

/**
 * One row in an agenda list — the mini calendar on the dashboard and the
 * full month view both render appointments this way, so a request only
 * looks one way anywhere in the product. `onSelect` is optional so the same
 * row still works anywhere a click-to-open detail panel doesn't apply.
 */
export function AppointmentRow({
  appointment,
  onConfirm,
  onDecline,
  onSelect,
  selected,
  showDate,
  away,
}: {
  appointment: DemoAppointment;
  onConfirm: (id: string) => void;
  onDecline: (id: string) => void;
  onSelect?: (appointment: DemoAppointment) => void;
  selected?: boolean;
  /** For a list that spans several days, where the time alone does not say when. */
  showDate?: boolean;
  /** Time off covers it: a pending request then cannot be accepted until the time off is shortened. */
  away?: boolean;
}) {
  const pending = appointment.status === "pending";

  return (
    <div
      onClick={onSelect ? () => onSelect(appointment) : undefined}
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onKeyDown={
        onSelect
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(appointment);
              }
            }
          : undefined
      }
      className={cn(
        "rounded-2xl border px-3.5 py-2",
        pending ? "border-amber-200 bg-amber-50/60" : "border-line bg-white",
        onSelect && "cursor-pointer transition-colors hover:border-brand-100",
        selected && "ring-2 ring-brand-500"
      )}
    >
      {/*
        Three columns, the same on every row and in every list: the time; who, with the job under
        it and the answer under that, starting where the name does; and on the right the status
        with the ZIP under it, on one edge so they line up down the list.
      */}
      <div className="grid grid-cols-[64px_minmax(0,1fr)_92px] items-center gap-x-3 gap-y-1">
        {/* From the name's line down, rather than centred on the whole row. */}
        <div className="row-span-2 self-start text-sm leading-5 font-semibold text-brand">
          {showDate && (
            <span className="block text-[11px] font-medium text-muted-ink">{format(appointment.date, "EEE, MMM d")}</span>
          )}
          {appointment.time}
        </div>

        <div className="flex min-w-0 items-center gap-1.5">
          <p className="truncate text-sm leading-5 font-semibold">{appointment.customerName}</p>
          {away && (
            <span className="shrink-0 rounded-full bg-slate-200/70 px-2 py-0.5 text-[11px] font-semibold text-muted-ink">
              Time off
            </span>
          )}
        </div>
        <Status pending={pending} />

        <p className="col-start-2 truncate text-xs text-muted-ink">{appointment.service}</p>
        <Zip zip={appointment.address.zip} />

        {pending && <Answer id={appointment.id} onConfirm={onConfirm} onDecline={onDecline} />}
      </div>
    </div>
  );
}

function Status({ pending }: { pending: boolean }) {
  return (
    <span
      className={cn(
        "w-fit rounded-full px-2 py-0.5 text-[11px] font-semibold",
        pending ? "bg-amber-500/15 text-amber-700" : "bg-go-bg text-[#07734F]"
      )}
    >
      {pending ? "Requested" : "Confirmed"}
    </span>
  );
}

/** Always takes its cell, so a row without a ZIP keeps the others' shape. */
function Zip({ zip }: { zip?: string | null }) {
  return (
    <span className="flex min-h-4 items-center gap-1 text-xs text-muted-ink">
      {zip && (
        <>
          <MapPin className="size-3" />
          {zip}
        </>
      )}
    </span>
  );
}

function Answer({
  id,
  onConfirm,
  onDecline,
}: {
  id: string;
  onConfirm: (id: string) => void;
  onDecline: (id: string) => void;
}) {
  return (
    <div className="col-span-2 col-start-2 mt-1 flex items-center gap-2">
      <Button
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          onConfirm(id);
        }}
        className="h-8 gap-1.5 rounded-full bg-go px-3 text-xs font-semibold text-white hover:bg-go/90"
      >
        <Check className="size-3.5" />
        Confirm
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={(e) => {
          e.stopPropagation();
          onDecline(id);
        }}
        className="h-8 gap-1.5 rounded-full border-line px-3 text-xs font-semibold text-muted-ink hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive"
      >
        <X className="size-3.5" />
        Decline
      </Button>
    </div>
  );
}
