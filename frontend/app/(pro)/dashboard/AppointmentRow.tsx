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
}: {
  appointment: DemoAppointment;
  onConfirm: (id: string) => void;
  onDecline: (id: string) => void;
  onSelect?: (appointment: DemoAppointment) => void;
  selected?: boolean;
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
        "flex flex-wrap items-center gap-3 rounded-2xl border px-3.5 py-3",
        pending ? "border-amber-200 bg-amber-50/60" : "border-line bg-white",
        onSelect && "cursor-pointer transition-colors hover:border-brand-100",
        selected && "ring-2 ring-brand-500"
      )}
    >
      <div className="w-[74px] shrink-0 text-sm font-semibold text-brand">{appointment.time}</div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold">{appointment.customerName}</p>
          <span
            className={
              pending
                ? "shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700"
                : "shrink-0 rounded-full bg-go-bg px-2 py-0.5 text-[11px] font-semibold text-[#07734F]"
            }
          >
            {pending ? "Requested" : "Confirmed"}
          </span>
        </div>
        <p className="truncate text-xs text-muted-ink">{appointment.service}</p>
      </div>

      <div className="flex shrink-0 items-center gap-1 text-xs text-muted-ink">
        <MapPin className="size-3" />
        {appointment.location}
      </div>

      {pending && (
        <div className="flex w-full shrink-0 items-center gap-2 min-[420px]:w-auto">
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onConfirm(appointment.id);
            }}
            className="h-8 flex-1 gap-1.5 rounded-full bg-go px-3 text-xs font-semibold text-white hover:bg-go/90 min-[420px]:flex-none"
          >
            <Check className="size-3.5" />
            Confirm
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              onDecline(appointment.id);
            }}
            className="h-8 flex-1 gap-1.5 rounded-full border-line px-3 text-xs font-semibold text-muted-ink hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive min-[420px]:flex-none"
          >
            <X className="size-3.5" />
            Decline
          </Button>
        </div>
      )}
    </div>
  );
}
