import { dayOf, timeLabel } from "@/components/marketing/availability";
import type { BusinessJobRequest } from "@/lib/api/inbox";

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
  notes: string;
  preferredContact?: DemoAppointment["preferredContact"];
}

/**
 * What the dashboard shows, out of what the API answers.
 *
 * <p>Only the two states a request can be in here. `DECLINED` and the rest are filtered out
 * before this, because the calendar draws what is on it and a declined request never was.
 */
export function incoming(request: BusinessJobRequest): IncomingRequest {
  return {
    id: request.id,
    day: dayOf(request.startsAt, request.timeZone),
    time: timeLabel(request.startsAt, request.timeZone),
    durationMinutes: request.estimatedDurationMinutes,
    status: request.status === "ACCEPTED" ? "confirmed" : "pending",
    customerName: request.customerName,
    // The dashboard's row expects a string and skips an empty one; absent means they gave none.
    phone: request.customerPhone ?? "",
    email: request.customerEmail,
    address: {
      // The customer types one address line; the dashboard was drawn for two boxes. Putting it
      // all in `street` and leaving `number` empty is what `addressLine` already skips over.
      street: request.street1,
      number: "",
      city: request.city,
      state: request.state,
      zip: request.postalCode,
    },
    service: request.serviceName,
    notes: request.description,
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
  };
}
