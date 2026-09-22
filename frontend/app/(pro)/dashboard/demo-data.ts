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

export interface DemoAppointment {
  id: string;
  customerName: string;
  service: string;
  date: Date;
  time: string;
  location: string;
  status: AppointmentStatus;
}

export const DEMO_APPOINTMENTS: DemoAppointment[] = [
  {
    id: "a1",
    customerName: "Anna Kowalski",
    service: "Outlet repair",
    date: today,
    time: "9:00 AM",
    location: "80203",
    status: "confirmed",
  },
  {
    id: "a2",
    customerName: "Ben Foster",
    service: "Water heater inspection",
    date: today,
    time: "1:30 PM",
    location: "80205",
    status: "pending",
  },
  {
    id: "a3",
    customerName: "Grace Liu",
    service: "Drain cleaning",
    date: addDays(today, 1),
    time: "11:00 AM",
    location: "80209",
    status: "pending",
  },
  {
    id: "a4",
    customerName: "Omar Haddad",
    service: "Faucet install",
    date: addDays(today, 2),
    time: "3:00 PM",
    location: "80202",
    status: "confirmed",
  },
  {
    id: "a5",
    customerName: "Lena Park",
    service: "Pipe repair estimate",
    date: addDays(today, 4),
    time: "10:00 AM",
    location: "80210",
    status: "pending",
  },
];

export interface DemoMessage {
  id: string;
  customerName: string;
  preview: string;
  receivedLabel: string;
  unread: boolean;
}

export const DEMO_MESSAGES: DemoMessage[] = [
  {
    id: "m1",
    customerName: "Sarah Mitchell",
    preview: "Hi, is the leaking pipe under my kitchen sink something you could look at this week?",
    receivedLabel: "12m ago",
    unread: true,
  },
  {
    id: "m2",
    customerName: "James Carter",
    preview: "Following up on my appointment tomorrow — can we push it to the afternoon?",
    receivedLabel: "2h ago",
    unread: true,
  },
  {
    id: "m3",
    customerName: "Priya Shah",
    preview: "Thanks for the quick fix yesterday, really appreciate it!",
    receivedLabel: "Yesterday",
    unread: false,
  },
  {
    id: "m4",
    customerName: "Tom Reilly",
    preview: "What's your rate for a water heater install?",
    receivedLabel: "2 days ago",
    unread: false,
  },
  {
    id: "m5",
    customerName: "Diane Osei",
    preview: "Just wanted to say the crew did a great job replacing our panel — very tidy work.",
    receivedLabel: "3 days ago",
    unread: false,
  },
  {
    id: "m6",
    customerName: "Marcus Webb",
    preview: "Can you give me a rough estimate for a whole-house rewire? Building is about 1,800 sq ft.",
    receivedLabel: "4 days ago",
    unread: false,
  },
  {
    id: "m7",
    customerName: "Elena Vargas",
    preview: "The outlet you fixed last month stopped working again, could someone take a look?",
    receivedLabel: "5 days ago",
    unread: false,
  },
];
