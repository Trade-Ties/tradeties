import { addMinutes, format } from "date-fns";

import { appointmentStart } from "./calendarFile";
import { addressLine, knownCustomers, type DemoAppointment, type DemoMessage, type KnownCustomer } from "./demo-data";

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
}

/**
 * What the form opens with when it is started from somebody: their request ("Book a different
 * time") or their conversation ("Book appointment").
 */
export interface BookingPrefill {
  customer: KnownCustomer;
  service?: string;
  notes?: string;
  replaces?: DemoAppointment;
}

/** The request as the form starts from it: the same customer, job and notes, a time to agree. */
export function prefillFrom(request: DemoAppointment): BookingPrefill {
  return {
    customer: { name: request.customerName, phone: request.phone, email: request.email, address: request.address },
    service: request.service,
    notes: request.notes,
    replaces: request.status === "pending" ? request : undefined,
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
