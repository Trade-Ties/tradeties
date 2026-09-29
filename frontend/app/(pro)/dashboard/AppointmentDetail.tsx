"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  Calendar as CalendarIcon,
  CalendarPlus,
  Check,
  Clock3,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Trash2,
  Wrench,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";

import { calendarFile, downloadCalendarFile } from "./calendarFile";
import { addressLine, type DemoAppointment } from "./demo-data";

/** A phone number as a link that dials it: `tel:` takes digits and a leading plus, nothing else. */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

/**
 * Everything the booking form collected, and the answer to it: confirm or decline while it is a
 * request, into the calendar once it is not. Shown wherever an appointment is opened — the
 * dashboard's panel, the calendar, and a conversation's booking — so it reads the same from each.
 */
export function AppointmentDetail({
  appointment,
  onConfirm,
  onDecline,
  onRebook,
  onChange,
  onRemove,
}: {
  appointment: DemoAppointment;
  /** Left out where nothing can answer the request, and the buttons are not drawn. */
  onConfirm?: (id: string) => void;
  onDecline?: (id: string) => void;
  onRebook?: (appointment: DemoAppointment) => void;
  /** Opens the form on a confirmed appointment, to move it or correct it. */
  onChange?: (appointment: DemoAppointment) => void;
  /** Takes a confirmed appointment out of the calendar, as cancelled by the business. */
  onRemove?: (id: string) => Promise<void>;
}) {
  const pending = appointment.status === "pending";
  const address = addressLine(appointment.address);
  // A customer agreed to this time, so changing it is asked about first; removing always is.
  const customerBooked = appointment.bookedBy !== "pro";
  const [asking, setAsking] = useState<"change" | "remove" | null>(null);
  const [removing, setRemoving] = useState(false);

  const proceed = async () => {
    if (asking === "change") {
      setAsking(null);
      onChange?.(appointment);
      return;
    }

    setRemoving(true);
    try {
      await onRemove?.(appointment.id);
    } finally {
      setRemoving(false);
      setAsking(null);
    }
  };

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
        {pending ? "Requested — needs your response" : appointment.bookedBy === "pro" ? "Confirmed · booked by you" : "Confirmed"}
      </span>

      <dl className="mt-5 flex flex-col gap-3 text-sm text-foreground">
        <Row icon={CalendarIcon}>{format(appointment.date, "EEEE, MMMM d")}</Row>
        <Row icon={Clock3}>{appointment.time}</Row>
        <Row icon={Wrench}>{appointment.service}</Row>
      </dl>

      {/* Always there on a customer's request; on one the tradesperson booked, only what they
          chose to fill in — so each part shows only when it has something in it. */}
      {appointment.notes && (
        <Section title="What they need done">
          <p className="rounded-xl bg-brand-50/60 px-3 py-2.5 text-sm leading-relaxed text-foreground">
            {appointment.notes}
          </p>
        </Section>
      )}

      {(appointment.phone || appointment.email || address) && (
        <Section title="Contact">
          <dl className="flex flex-col gap-3 text-sm text-foreground">
            {appointment.phone && (
              <Row icon={Phone}>
                <ContactLink href={telHref(appointment.phone)}>{appointment.phone}</ContactLink>
                {appointment.preferredContact === "phone" && <PreferredTag />}
              </Row>
            )}
            {appointment.email && (
              <Row icon={Mail}>
                <ContactLink href={`mailto:${appointment.email}`}>{appointment.email}</ContactLink>
                {appointment.preferredContact === "email" && <PreferredTag />}
              </Row>
            )}
            {address && (
              <Row icon={MapPin}>
                {/* Opens directions in whatever maps app the device hands a maps link to. */}
                <ContactLink
                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`}
                  external
                >
                  {address}
                </ContactLink>
              </Row>
            )}
          </dl>
        </Section>
      )}

      {/* Only once confirmed: a request can still be declined, and should not be sitting in
          anybody's calendar until it cannot. */}
      {!pending && (
        <Button
          variant="outline"
          onClick={() =>
            downloadCalendarFile(`${appointment.service} – ${appointment.customerName}.ics`, calendarFile([appointment]))
          }
          className="mt-6 h-9 w-full gap-1.5 rounded-full border-line text-sm font-semibold text-muted-ink hover:bg-brand-50 hover:text-brand-500"
        >
          <CalendarPlus className="size-4" />
          Add to my calendar
        </Button>
      )}

      {/* Any confirmed appointment, whoever booked it; a request still waiting is answered instead. */}
      {!pending && (onChange || onRemove) && asking === null && (
        <div className="mt-2 flex gap-2">
          {onChange && (
            <Button
              variant="outline"
              onClick={() => (customerBooked ? setAsking("change") : onChange(appointment))}
              className="h-9 flex-1 gap-1.5 rounded-full border-line text-sm font-semibold text-muted-ink hover:bg-brand-50 hover:text-brand-500"
            >
              <Pencil className="size-4" />
              Change
            </Button>
          )}
          {onRemove && (
            <Button
              variant="outline"
              onClick={() => setAsking("remove")}
              className="h-9 flex-1 gap-1.5 rounded-full border-line text-sm font-semibold text-muted-ink hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive"
            >
              <Trash2 className="size-4" />
              Remove
            </Button>
          )}
        </div>
      )}

      {!pending && asking !== null && (
        <div role="alert" className="mt-2 rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-800">
          <p className="font-semibold">
            {customerBooked
              ? "Are you sure? The customer asked for this appointment."
              : "Remove this appointment from your calendar?"}
          </p>
          {customerBooked && (
            <p className="mt-1 text-xs">
              {asking === "change"
                ? "Change it only once they have agreed to the new time."
                : "Removing it cancels it for them."}
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <Button
              onClick={() => void proceed()}
              disabled={removing}
              className={
                asking === "remove"
                  ? "h-9 flex-1 rounded-full bg-destructive text-sm font-semibold text-white hover:bg-destructive/90"
                  : "h-9 flex-1 rounded-full text-sm font-semibold"
              }
            >
              {asking === "change" ? "Yes, change it" : removing ? "Removing…" : "Yes, remove it"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setAsking(null)}
              disabled={removing}
              className="h-9 flex-1 rounded-full border-line text-sm font-semibold text-muted-ink"
            >
              Keep it
            </Button>
          </div>
        </div>
      )}

      {pending && onConfirm && onDecline && (
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

      {/* The time asked for does not work, and another was agreed — in the conversation or on
          the phone. Booking it replaces this request and tells the customer. */}
      {pending && onRebook && (
        <button
          type="button"
          onClick={() => onRebook(appointment)}
          className="mt-3 w-full text-center text-xs font-semibold text-brand-500 hover:underline"
        >
          Agreed on another time? Book a different time
        </button>
      )}
    </div>
  );
}

function Row({ icon: Icon, children }: { icon: typeof Clock3; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand-50">
        <Icon className="size-3.5 text-brand-500" />
      </span>
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">{children}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 border-t border-line pt-4">
      <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-faint">{title}</h3>
      {children}
    </section>
  );
}

function ContactLink({
  href,
  external,
  children,
}: {
  href: string;
  external?: boolean;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="min-w-0 break-words text-brand underline-offset-2 hover:text-brand-500 hover:underline"
    >
      {children}
    </a>
  );
}

/** The customer's answer to "Preferred contact method", marked on the line it picked. */
function PreferredTag() {
  return (
    <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-500">
      Preferred
    </span>
  );
}
