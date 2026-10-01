import { dayOf, timeLabel } from "@/components/marketing/availability";
import { fromE164 } from "@/components/profile/phone";
import type { BusinessJobRequest, JobRequestStatus } from "@/lib/api/inbox";

import type { DemoAppointment, ServiceAddress } from "./demo-data";

/**
 * A real request, reduced on the server to what the dashboard draws.
 *
 * <p><strong>The day is a string and the time is already written out.</strong> Both are worked out
 * against the business's own zone, which is the only clock an appointment means anything on. A
 * `Date` built here instead would be an instant, and the browser would render it on its own clock
 * — for a pro away from home that is the wrong hour, and for an evening job the wrong day.
 */
export interface IncomingRequest {
  id: string;
  /** `YYYY-MM-DD` in the business's zone. */
  day: string;
  /** Already written out, e.g. "9:00 AM". */
  time: string;
  durationMinutes: number;
  status: DemoAppointment["status"];
  customerName: string;
  phone: string;
  email: string;
  address: ServiceAddress;
  service: string;
  serviceId: string;
  notes: string;
  preferredContact?: DemoAppointment["preferredContact"];
  bookedByBusiness: boolean;
  detailsEditable: boolean;
  declineReason?: string;
}

/**
 * What the dashboard shows, out of what the API answers.
 *
 * <p>The calendar filters out all but pending and accepted before this, because it draws what is
 * on it and a declined request never was; the inbox keeps the rest, to say how a request ended.
 */
export function incoming(request: BusinessJobRequest): IncomingRequest {
  return {
    id: request.id,
    day: dayOf(request.startsAt, request.timeZone),
    time: timeLabel(request.startsAt, request.timeZone),
    // The span, not the estimate: an appointment the business booked runs as long as it chose.
    durationMinutes: (Date.parse(request.endsAt) - Date.parse(request.startsAt)) / 60_000,
    status: statusOf(request.status),
    declineReason: request.declineReason,
    customerName: request.customerName,
    // The dashboard's rows expect strings and skip an empty one; absent means nobody gave one.
    phone: fromE164(request.customerPhone ?? ""),
    email: request.customerEmail ?? "",
    address: {
      // One address line on the wire; the dashboard was drawn for two boxes. Putting it all in
      // `street` and leaving `number` empty is what `addressLine` already skips over.
      street: request.street1 ?? "",
      number: "",
      city: request.city ?? "",
      state: request.state ?? "",
      zip: request.postalCode ?? "",
    },
    service: request.serviceName,
    serviceId: request.serviceId,
    notes: request.description ?? "",
    bookedByBusiness: request.bookedBy === "BUSINESS",
    detailsEditable: request.detailsFrom === "BUSINESS",
    preferredContact:
      request.preferredContact === "PHONE"
        ? "phone"
        : request.preferredContact === "EMAIL"
          ? "email"
          : undefined,
  };
}

/**
 * The browser's half of the conversion: the calendar day as a local `Date`.
 *
 * <p>Built from the three numbers rather than parsed, because `new Date("2026-10-05")` is midnight
 * UTC — which in Denver is the evening of the fourth, and a job would sit on the wrong day of the
 * grid. Every comparison the dashboard makes is `isSameDay` against a locally built day, so this
 * has to be one too.
 *
 * <p>Must run in the browser. Called on the server the date would be the server's local midnight,
 * serialised as an instant, and read back on another clock.
 */
export function asAppointment(request: IncomingRequest): DemoAppointment {
  const [year, month, day] = request.day.split("-").map(Number);

  return {
    id: request.id,
    customerName: request.customerName,
    phone: request.phone,
    email: request.email,
    address: request.address,
    service: request.service,
    notes: request.notes,
    preferredContact: request.preferredContact,
    date: new Date(year!, month! - 1, day!),
    time: request.time,
    durationMinutes: request.durationMinutes,
    status: request.status,
    serviceId: request.serviceId,
    bookedBy: request.bookedByBusiness ? "pro" : undefined,
    detailsEditable: request.detailsEditable,
    declineReason: request.declineReason,
  };
}

/**
 * The API's six states in the four the views draw. A finished job was still a confirmed one, and a
 * withdrawn request — which nothing can do yet — ends the same way as a cancelled appointment.
 */
export function statusOf(status: JobRequestStatus): DemoAppointment["status"] {
  switch (status) {
    case "PENDING":
      return "pending";
    case "ACCEPTED":
    case "COMPLETED":
      return "confirmed";
    case "DECLINED":
      return "declined";
    case "WITHDRAWN":
    case "CANCELLED":
      return "cancelled";
  }
}
