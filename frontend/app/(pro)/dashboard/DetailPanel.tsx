import { format } from "date-fns";
import { Calendar as CalendarIcon, Check, Clock3, MapPin, Wrench, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { DemoAppointment, DemoMessage } from "./demo-data";

export type Selection =
  | { type: "appointment"; item: DemoAppointment }
  | { type: "message"; item: DemoMessage };

export function DetailPanel({
  selection,
  onClose,
  onConfirm,
  onDecline,
}: {
  selection: Selection;
  onClose: () => void;
  onConfirm: (id: string) => void;
  onDecline: (id: string) => void;
}) {
  return (
    <div className="w-full shrink-0 duration-200 animate-in fade-in slide-in-from-right-4 lg:w-[360px]">
      <div className="sticky top-4 rounded-3xl border border-line bg-white p-5 shadow-lift">
        <div className="mb-4 flex items-start justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-faint">
            {selection.type === "appointment" ? "Appointment" : "Message"}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-7 shrink-0 place-items-center rounded-full text-muted-ink hover:bg-brand-50 hover:text-brand-500"
          >
            <X className="size-4" />
          </button>
        </div>

        {selection.type === "appointment" ? (
          <AppointmentDetail appointment={selection.item} onConfirm={onConfirm} onDecline={onDecline} />
        ) : (
          <MessageDetail message={selection.item} />
        )}
      </div>
    </div>
  );
}

function AppointmentDetail({
  appointment,
  onConfirm,
  onDecline,
}: {
  appointment: DemoAppointment;
  onConfirm: (id: string) => void;
  onDecline: (id: string) => void;
}) {
  const pending = appointment.status === "pending";

  return (
    <div>
      <h2 className="text-xl font-bold tracking-[-0.01em] text-brand">{appointment.customerName}</h2>
      <span
        className={
          pending
            ? "mt-2 inline-flex rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-700"
            : "mt-2 inline-flex rounded-full bg-go-bg px-2.5 py-1 text-xs font-semibold text-[#07734F]"
        }
      >
        {pending ? "Requested — needs your response" : "Confirmed"}
      </span>

      <dl className="mt-5 flex flex-col gap-3 text-sm text-foreground">
        <Row icon={CalendarIcon}>{format(appointment.date, "EEEE, MMMM d")}</Row>
        <Row icon={Clock3}>{appointment.time}</Row>
        <Row icon={Wrench}>{appointment.service}</Row>
        <Row icon={MapPin}>{appointment.location}</Row>
      </dl>

      {pending && (
        <div className="mt-6 flex gap-2">
          <Button
            onClick={() => onConfirm(appointment.id)}
            className="h-9 flex-1 gap-1.5 rounded-full bg-go text-sm font-semibold text-white hover:bg-go/90"
          >
            <Check className="size-4" />
            Confirm
          </Button>
          <Button
            variant="outline"
            onClick={() => onDecline(appointment.id)}
            className="h-9 flex-1 gap-1.5 rounded-full border-line text-sm font-semibold text-muted-ink hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive"
          >
            <X className="size-4" />
            Decline
          </Button>
        </div>
      )}
    </div>
  );
}

function MessageDetail({ message }: { message: DemoMessage }) {
  return (
    <div>
      <h2 className="text-xl font-bold tracking-[-0.01em] text-brand">{message.customerName}</h2>
      <p className="mt-1 text-xs text-faint">{message.receivedLabel}</p>
      <p className="mt-4 text-sm leading-relaxed text-foreground">{message.preview}</p>
    </div>
  );
}

function Row({ icon: Icon, children }: { icon: typeof Clock3; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand-50">
        <Icon className="size-3.5 text-brand-500" />
      </span>
      {children}
    </div>
  );
}
