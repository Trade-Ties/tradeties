import { addMinutes, format } from "date-fns";

import { toE164 } from "@/components/profile/phone";
import type { Service } from "@/lib/api/business";
import type {
  AppointmentChange,
  AppointmentConflict,
  AppointmentInput,
  AppointmentResolution,
} from "@/lib/api/inbox";

import { appointmentStart } from "./calendarFile";
import { addressLine, knownCustomers, type DemoAppointment, type DemoMessage, type KnownCustomer } from "./demo-data";

/** One of the business's own active services, as the booking form offers it. */
export interface ServiceOption {
  id: string;
  name: string;
  durationMinutes: number;
}

/** Only active ones: the server refuses to book an inactive service. */
export function serviceOptionsOf(services: Service[] | null | undefined): ServiceOption[] {
  return (services ?? [])
    .filter((service) => service.active)
    .map((service) => ({ id: service.id, name: service.name, durationMinutes: service.estimatedDurationMinutes }));
}

/**
 * An appointment the tradesperson books themselves, and what should happen around it — the
 * form's answer, handed to whichever screen owns the calendar and the conversations.
 */
export interface NewBooking {
  appointment: Omit<DemoAppointment, "id">;
  /**
   * Whether the customer is sent a confirmation. It goes into their conversation as a message,
   * and reaches them as an email with the appointment attached for their own calendar.
   */
  notify: boolean;
  /** A request this takes the place of — agreed on another day or time, often by phone. */
  replacesId?: string;
  /** The span on the business's clock, `YYYY-MM-DDTHH:mm` — see `wallClock.ts`. */
  startsAt: string;
  endsAt: string;
  /** What happens to the accepted appointments in the way, once the server has named them. */
  resolutions?: AppointmentResolution[];
}

/** Where a booking got to: done, appointments in the way to put to the tradesperson, or a refusal. */
export type BookResult =
  | { kind: "saved" }
  | { kind: "conflicts"; conflicts: AppointmentConflict[] }
  | { kind: "refused"; message: string };

/**
 * What the form opens with when it is started from somebody: their request ("Book a different
 * time") or their conversation ("Book appointment").
 */
export interface BookingPrefill {
  customer: KnownCustomer;
  service?: string;
  serviceId?: string;
  notes?: string;
  replaces?: DemoAppointment;
}

/** The request as the form starts from it: the same customer, job and notes, a time to agree. */
export function prefillFrom(request: DemoAppointment): BookingPrefill {
  return {
    customer: { name: request.customerName, phone: request.phone, email: request.email, address: request.address },
    service: request.service,
    serviceId: request.serviceId,
    notes: request.notes,
    replaces: request.status === "pending" ? request : undefined,
  };
}

/** Left out rather than sent empty: an empty postal code or phone fails the contract's pattern. */
const given = (value: string) => (value.trim() === "" ? undefined : value.trim());

function customerFields(booking: NewBooking) {
  const { appointment } = booking;

  return {
    customerName: appointment.customerName,
    customerPhone: given(toE164(appointment.phone)),
    customerEmail: given(appointment.email),
    street1: given([appointment.address.number, appointment.address.street].filter(Boolean).join(" ")),
    city: given(appointment.address.city),
    state: given(appointment.address.state),
    postalCode: given(appointment.address.zip),
    notes: given(appointment.notes),
  };
}

export function appointmentBody(booking: NewBooking): AppointmentInput {
  return {
    serviceId: booking.appointment.serviceId!,
    startsAt: booking.startsAt,
    endsAt: booking.endsAt,
    replacesRequestId: booking.replacesId,
    resolutions: booking.resolutions,
    ...customerFields(booking),
  };
}

export function changeBody(booking: NewBooking): AppointmentChange {
  return {
    startsAt: booking.startsAt,
    endsAt: booking.endsAt,
    resolutions: booking.resolutions,
    ...customerFields(booking),
  };
}

/** "Drain cleaning · Sat, Sep 26 · 2:00 PM – 3:00 PM", and the address under it when there is one. */
export function confirmationText(appointment: Omit<DemoAppointment, "id">): string {
  const start = appointmentStart(appointment);
  const end = addMinutes(start, appointment.durationMinutes);
  const when = `${format(start, "EEE, MMM d")} · ${format(start, "h:mm a")} – ${format(end, "h:mm a")}`;
  const where = addressLine(appointment.address);

  return [`${appointment.service} · ${when}`, where].filter(Boolean).join("\n");
}

/**
 * The conversations after a confirmation has gone out: added to the customer's conversation, or
 * starting one when there is none yet — somebody who only ever phoned. Either way it moves to the
 * top, as a new message does.
 *
 * Matched on the name because that is what the demo data shares between the two lists; stored
 * data would match on the customer's id.
 */
export function withConfirmation(
  conversations: DemoMessage[],
  appointmentId: string,
  appointment: Omit<DemoAppointment, "id">
): DemoMessage[] {
  const existing = conversations.find((c) => c.customerName === appointment.customerName);
  const id = existing?.id ?? `c-${appointmentId}`;
  const thread = existing?.thread ?? [];

  const confirmed: DemoMessage = {
    id,
    customerName: appointment.customerName,
    appointmentId,
    unread: false,
    thread: [
      ...thread,
      {
        id: `${id}-${thread.length + 1}`,
        from: "pro",
        kind: "booking",
        text: confirmationText(appointment),
        sentAt: new Date(),
      },
    ],
  };

  return [confirmed, ...conversations.filter((c) => c.id !== id)];
}

/**
 * The form started from a conversation: the request it is about when there is one — so booking
 * it replaces that request — and otherwise whatever the calendar already knows about the
 * customer, down to only their name.
 */
export function prefillForConversation(conversation: DemoMessage, appointments: DemoAppointment[]): BookingPrefill {
  const request = appointments.find((a) => a.id === conversation.appointmentId);
  if (request) return prefillFrom(request);

  const known = knownCustomers(appointments).find((c) => c.name === conversation.customerName);
  return {
    customer: known ?? {
      name: conversation.customerName,
      phone: "",
      email: "",
      address: { street: "", number: "", city: "", state: "", zip: "" },
    },
  };
}
