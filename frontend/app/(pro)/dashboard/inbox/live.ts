import type { Conversation, ConversationSummary } from "@/lib/api/inbox";

import type { DemoAppointment, DemoMessage } from "../demo-data";

/**
 * The inbox's real data in the shapes its views were built on.
 *
 * The conversation and booking views were written against the dashboard's demo types, and still
 * serve the demo dashboard beside this page. Converting here, rather than rewriting them, keeps one
 * way of drawing a conversation for both.
 *
 * Every time is converted on the business's clock — the zone the request carries — so the day and
 * the "9:00 AM" read what the tradesperson will turn up at, wherever the browser happens to be.
 */

/** A request's messages as a thread, opened by what the customer wrote with the request. */
export function threadOf(conversation: Conversation): DemoMessage {
  const { request } = conversation;

  return {
    id: request.id,
    customerName: conversation.customerName,
    appointmentId: request.id,
    unread: false,
    thread: [
      {
        id: `${request.id}-request`,
        from: "customer",
        text: conversation.description,
        sentAt: new Date(conversation.requestedAt),
        kind: "request",
      },
      ...conversation.messages.map((message) => ({
        id: message.id,
        from: message.author === "BUSINESS" ? ("pro" as const) : ("customer" as const),
        text: message.body,
        sentAt: new Date(message.sentAt),
      })),
    ],
  };
}

/** The request as the booking view draws an appointment. */
export function appointmentOf(conversation: Conversation): DemoAppointment {
  const { request, address } = conversation;
  const start = new Date(request.startsAt);

  return {
    id: request.id,
    customerName: conversation.customerName,
    phone: conversation.customerPhone ?? "",
    email: conversation.customerEmail,
    address: {
      street: [address.street1, address.street2].filter(Boolean).join(", "),
      number: "",
      city: address.city,
      state: address.state,
      zip: address.postalCode,
    },
    service: request.serviceName,
    notes: conversation.description,
    date: dayIn(start, request.timeZone),
    time: new Intl.DateTimeFormat("en-US", { timeZone: request.timeZone, hour: "numeric", minute: "2-digit" }).format(
      start
    ),
    durationMinutes: request.estimatedDurationMinutes,
    // Only a request and an accepted one exist in the views; anything settled reads as the latter.
    status: request.status === "PENDING" ? "pending" : "confirmed",
  };
}

/** One inbox row: who, the latest line, when, and whether there is anything unread. */
export function rowOf(summary: ConversationSummary) {
  return {
    id: summary.requestId,
    customerName: summary.customerName,
    preview: summary.lastMessage.body,
    fromBusiness: summary.lastMessage.author === "BUSINESS",
    sentAt: new Date(summary.lastMessage.sentAt),
    unread: summary.unreadCount > 0,
  };
}

/** Midnight of the day an instant falls on in a zone, as the views' `date` expects. */
function dayIn(instant: Date, timeZone: string): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(instant);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);

  return new Date(part("year"), part("month") - 1, part("day"));
}
