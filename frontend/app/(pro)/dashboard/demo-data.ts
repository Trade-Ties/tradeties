import { addDays } from "date-fns";

/**
 * Illustrative sample data for the dashboard's inbox and calendar.
 *
 * There is no booking or messaging endpoint anywhere in the API yet (see
 * api/openapi.yaml — only business-profile data exists), so nobody can
 * actually book a job or message a tradesperson today. This file exists so
 * the dashboard demos the shape that data will have once that backend
 * exists, clearly separated from the real data the page also fetches
 * (business profile, trades, working hours, readiness). Swap it for real
 * API calls once bookings/messages are a real concept server-side.
 */

// Computed at import time so "today" always reflects the local date rather
// than a hardcoded one, matching the same convention used on the customer
// marketplace side (components/marketing/pros-data.ts).
const today = new Date(new Date().setHours(0, 0, 0, 0));

/**
 * A booking request starts "pending" — the pro has to confirm or decline it —
 * and only shows on the calendar as a real commitment once "confirmed".
 * There's no third "declined" state to render: declining just removes it
 * from view (see DashboardCalendar/CalendarMonth's local state).
 */
export type AppointmentStatus = "pending" | "confirmed";

/**
 * Where the job is, as the customer typed it into the booking form: street and house number in
 * separate boxes, a five-digit ZIP.
 */
export interface ServiceAddress {
  street: string;
  number: string;
  city: string;
  state: string;
  zip: string;
}

/**
 * One line, the way it is read out: "1420 Pearl St, Denver, CO 80203". Empty when nothing was
 * given, which only an appointment the tradesperson booked themselves can be; a part left out is
 * skipped rather than leaving a gap.
 */
export function addressLine(a: ServiceAddress): string {
  const street = [a.number, a.street].filter(Boolean).join(" ");
  const region = [a.state, a.zip].filter(Boolean).join(" ");
  return [street, a.city, region].filter(Boolean).join(", ");
}

export type ContactMethod = "phone" | "email";

/**
 * Everything the customer's booking form collects, so the detail panel can show the
 * tradesperson what they need to take the job: who to call, where to go, and what it is about.
 */
export interface DemoAppointment {
  id: string;
  customerName: string;
  phone: string;
  email: string;
  address: ServiceAddress;
  service: string;
  /** "What do you need done?" — the customer's own words. */
  notes: string;
  /** Optional on the form, so not every request has one. */
  preferredContact?: ContactMethod;
  date: Date;
  time: string;
  /** How long the booked service runs — its duration from the profile's services. */
  durationMinutes: number;
  status: AppointmentStatus;
  /**
   * Set when the tradesperson put it in themselves, for a customer who phoned or a regular,
   * rather than the customer requesting it. Contact details and address are optional then: the
   * tradesperson may already know them.
   */
  bookedBy?: "pro";
}

export const DEMO_APPOINTMENTS: DemoAppointment[] = [
  {
    id: "a1",
    customerName: "Anna Kowalski",
    phone: "(303) 555-0147",
    email: "anna.kowalski@email.com",
    address: { street: "Pearl St", number: "1420", city: "Denver", state: "CO", zip: "80203" },
    service: "Outlet repair",
    notes: "Two outlets in the kitchen stopped working after a breaker tripped. Resetting it didn't help.",
    preferredContact: "phone",
    date: today,
    time: "9:00 AM",
    durationMinutes: 60,
    status: "confirmed",
  },
  {
    id: "a2",
    customerName: "Ben Foster",
    phone: "(720) 555-0193",
    email: "ben.foster@email.com",
    address: { street: "E 26th Ave", number: "3315", city: "Denver", state: "CO", zip: "80205" },
    service: "Water heater inspection",
    notes: "Water heater is about 12 years old and makes a rumbling noise when heating. Would like it checked before winter.",
    preferredContact: "email",
    date: today,
    time: "1:30 PM",
    durationMinutes: 90,
    status: "pending",
  },
  {
    id: "a3",
    customerName: "Grace Liu",
    phone: "(303) 555-0128",
    email: "grace.liu@email.com",
    address: { street: "S Gaylord St", number: "905", city: "Denver", state: "CO", zip: "80209" },
    service: "Drain cleaning",
    notes: "Bathroom sink and tub are both draining very slowly. Tried a plunger, no luck.",
    date: addDays(today, 1),
    time: "11:00 AM",
    durationMinutes: 60,
    status: "pending",
  },
  {
    id: "a4",
    customerName: "Omar Haddad",
    phone: "(720) 555-0164",
    email: "omar.haddad@email.com",
    address: { street: "Larimer St", number: "1801", city: "Denver", state: "CO", zip: "80202" },
    service: "Faucet install",
    notes: "I've bought a new kitchen faucet and need it installed in place of the old one.",
    preferredContact: "phone",
    date: addDays(today, 2),
    time: "3:00 PM",
    durationMinutes: 120,
    status: "confirmed",
  },
  {
    id: "a5",
    customerName: "Lena Park",
    phone: "(303) 555-0172",
    email: "lena.park@email.com",
    address: { street: "S Pearl St", number: "2250", city: "Denver", state: "CO", zip: "80210" },
    service: "Pipe repair estimate",
    notes: "Small leak on a pipe in the basement ceiling. Need an estimate for the repair.",
    preferredContact: "email",
    date: addDays(today, 4),
    time: "10:00 AM",
    durationMinutes: 60,
    status: "pending",
  },
];

/**
 * Something the tradesperson put in their own calendar — a supplier run, a day off, a job booked
 * outside TradeTies. It is theirs rather than a customer's, and it holds the time: nobody can be
 * booked into it.
 */
export interface CalendarEntry {
  id: string;
  title: string;
  start: Date;
  end: Date;
  notes?: string;
}

export const DEMO_ENTRIES: CalendarEntry[] = [
  {
    id: "e1",
    title: "Supplier pickup",
    start: new Date(addDays(today, 1).setHours(7, 30)),
    end: new Date(addDays(today, 1).setHours(8, 30)),
    notes: "Collect the water heater order at Ferguson.",
  },
];

/**
 * Days the tradesperson is away — a vacation, a trade show, a surgery — and whole days off: no
 * slot inside is offered to customers.
 *
 * Whole days, both ends included, in the business's own calendar. The backend already stores
 * this (`availability_time_off`) and already leaves it out of the free slots; what it does not
 * have yet is a way to write it, which is why this is demo data.
 */
export interface TimeOff {
  id: string;
  /** The first day away, at midnight. */
  from: Date;
  /** The last day away, at midnight — included. */
  to: Date;
  note?: string;
}

export const DEMO_TIME_OFF: TimeOff[] = [
  {
    id: "t1",
    from: addDays(today, 16),
    to: addDays(today, 22),
    note: "Family vacation",
  },
];

/** Whether a day falls inside a stretch of time off. */
export function isOff(day: Date, timeOff: TimeOff[]): TimeOff | undefined {
  const t = new Date(day).setHours(0, 0, 0, 0);
  return timeOff.find((off) => t >= off.from.getTime() && t <= off.to.getTime());
}

/** One message in a conversation, from either side. */
export interface ThreadMessage {
  id: string;
  from: "customer" | "pro";
  text: string;
  sentAt: Date;
  /**
   * Not typed as a message, but sent along with something:
   * - `request`: the customer's own "What do you need done?", which a booking request opens its
   *   conversation with;
   * - `booking`: the confirmation of an appointment the tradesperson booked for the customer,
   *   which reaches them as an email with the appointment attached for their calendar.
   */
  kind?: "request" | "booking";
}

/**
 * A conversation with one customer, oldest message first — the shape a messages API would hand
 * back.
 *
 * Every one starts with a booking request: sending one opens the conversation, with what the
 * customer wrote about the job as its first message. The customer has no account, so their side
 * of it runs on email — each message from the tradesperson is emailed to them, and a reply to
 * that email comes back in here.
 */
export interface DemoMessage {
  id: string;
  customerName: string;
  /** The request that opened it, while it is still on the calendar; absent for a finished job. */
  appointmentId?: string;
  /** Whether the customer's latest message has been opened. */
  unread: boolean;
  thread: ThreadMessage[];
}

/**
 * Somebody the tradesperson has had a job or a request from, as the booking form can fill them in
 * again: typing a name it knows brings back the rest.
 */
export interface KnownCustomer {
  name: string;
  phone: string;
  email: string;
  address: ServiceAddress;
}

/** Everyone in the calendar, once each, by name — the latest appointment's details winning. */
export function knownCustomers(appointments: DemoAppointment[]): KnownCustomer[] {
  const byName = new Map<string, KnownCustomer>();
  for (const a of [...appointments].sort((x, y) => x.date.getTime() - y.date.getTime())) {
    byName.set(a.customerName, { name: a.customerName, phone: a.phone, email: a.email, address: a.address });
  }
  return [...byName.values()].sort((x, y) => x.name.localeCompare(y.name));
}

/** The newest message, which is what a list row previews and dates itself by. */
export function latestMessage(conversation: DemoMessage): ThreadMessage {
  return conversation.thread[conversation.thread.length - 1];
}

// Minutes before the page was built, so "12m" and "Yesterday" stay true whenever it is opened.
const now = new Date();
const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000);
const HOUR = 60;
const DAY = 24 * HOUR;

/** The message a booking request opens its conversation with. */
function opening(appointment: DemoAppointment, sentAt: Date): ThreadMessage {
  return {
    id: `${appointment.id}-request`,
    from: "customer",
    text: appointment.notes,
    sentAt,
    kind: "request",
  };
}

const appointment = (id: string) => DEMO_APPOINTMENTS.find((a) => a.id === id)!;

export const DEMO_MESSAGES: DemoMessage[] = [
  {
    id: "c-a2",
    customerName: "Ben Foster",
    appointmentId: "a2",
    unread: true,
    thread: [opening(appointment("a2"), ago(12))],
  },
  {
    id: "c-a3",
    customerName: "Grace Liu",
    appointmentId: "a3",
    unread: true,
    thread: [
      opening(appointment("a3"), ago(DAY + 5 * HOUR)),
      {
        id: "c-a3-2",
        from: "pro",
        text: "Thanks Grace, got it. Is it just the bathroom sink, or the tub as well?",
        sentAt: ago(DAY + 3 * HOUR),
      },
      {
        id: "c-a3-3",
        from: "customer",
        text: "Both, unfortunately. Also — could we push it to the afternoon? Something came up in the morning.",
        sentAt: ago(2 * HOUR),
      },
    ],
  },
  {
    id: "c-a1",
    customerName: "Anna Kowalski",
    appointmentId: "a1",
    unread: false,
    thread: [
      opening(appointment("a1"), ago(DAY + 7 * HOUR)),
      {
        id: "c-a1-2",
        from: "pro",
        text: "Confirmed for 9 AM. If you can, leave the breaker panel accessible — I'll start there.",
        sentAt: ago(DAY + 6 * HOUR),
      },
      {
        id: "c-a1-3",
        from: "customer",
        text: "Will do, see you then!",
        sentAt: ago(DAY + 5 * HOUR),
      },
    ],
  },
  {
    id: "c-past",
    customerName: "Priya Shah",
    unread: false,
    thread: [
      {
        id: "c-past-request",
        from: "customer",
        text: "The pipe under my kitchen sink is leaking and there's water in the cabinet. Could you come by?",
        sentAt: ago(9 * DAY),
        kind: "request",
      },
      {
        id: "c-past-2",
        from: "pro",
        text: "All done — the pipe is replaced and the cabinet is dry. Give me a shout if anything changes.",
        sentAt: ago(3 * DAY),
      },
      {
        id: "c-past-3",
        from: "customer",
        text: "Thanks for the quick fix, really appreciate it!",
        sentAt: ago(2 * DAY + 4 * HOUR),
      },
    ],
  },
  {
    id: "c-a5",
    customerName: "Lena Park",
    appointmentId: "a5",
    unread: false,
    thread: [
      opening(appointment("a5"), ago(4 * DAY)),
      {
        id: "c-a5-2",
        from: "pro",
        text: "Thanks Lena. If the leak gets worse before Tuesday, shut the valve under the upstairs bathroom sink.",
        sentAt: ago(4 * DAY - 2 * HOUR),
      },
    ],
  },
  {
    id: "c-a4",
    customerName: "Omar Haddad",
    appointmentId: "a4",
    unread: false,
    thread: [
      opening(appointment("a4"), ago(6 * DAY)),
      {
        id: "c-a4-2",
        from: "pro",
        text: "Confirmed. Bring the faucet's box if you still have it — the fittings are usually inside.",
        sentAt: ago(6 * DAY - HOUR),
      },
    ],
  },
];

/**
 * What customers have said, newest first. There is no review endpoint either, and no decision
 * yet on where reviews come from (a customer reviewing a completed booking, or an outside
 * source), so this only demos the shape the rating badge needs: a star count per review, and the
 * average and total worked out from the list.
 */
export interface DemoReview {
  id: string;
  customerName: string;
  /** Whole stars, 1 to 5. */
  rating: number;
  text: string;
  postedLabel: string;
}

export const DEMO_REVIEWS: DemoReview[] = [
  {
    id: "r1",
    customerName: "Priya Shah",
    rating: 5,
    text: "Came out the same day for a burst pipe, explained exactly what went wrong and left the place spotless.",
    postedLabel: "2 days ago",
  },
  {
    id: "r2",
    customerName: "Diane Osei",
    rating: 5,
    text: "Fair quote up front and no surprises on the bill. Will book again.",
    postedLabel: "1 week ago",
  },
  {
    id: "r3",
    customerName: "Marcus Lee",
    rating: 4,
    text: "Good work on the water heater. Arrived about 30 minutes later than the slot, but called ahead.",
    postedLabel: "2 weeks ago",
  },
  {
    id: "r4",
    customerName: "Tom Reilly",
    rating: 5,
    text: "Fixed a leak two other plumbers couldn't find. Highly recommend.",
    postedLabel: "3 weeks ago",
  },
  {
    id: "r5",
    customerName: "Hannah Brooks",
    rating: 3,
    text: "The repair itself was fine, but it took two visits because a part wasn't on the van.",
    postedLabel: "1 month ago",
  },
  {
    id: "r6",
    customerName: "James Carter",
    rating: 5,
    text: "Friendly, quick and tidy. Replaced both bathroom taps in under an hour.",
    postedLabel: "2 months ago",
  },
];
