"use client";

import { useRef, useState } from "react";
import { format } from "date-fns";
import { ArrowLeft, CalendarDays, ChevronRight, CircleCheck, Phone, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { AppointmentDetail, STATUS_TONE, telHref } from "./AppointmentDetail";
import { prefersPhone, type DemoAppointment, type DemoMessage } from "./demo-data";
import { messageTime } from "./messageTime";

/**
 * A conversation with one customer — the messages, the booking request it is about, and the box
 * to answer in. The inbox and the dashboard's side panel both show it, so a reply looks and works
 * the same from either.
 *
 * Sending is the parent's: it owns the list the conversation is in, and the conversation's row
 * has to move with the new message.
 */
export function Conversation({
  conversation,
  appointment,
  onSend,
  onConfirm,
  onDecline,
  onRebook,
  onOpenDetails,
  detailsOpen,
  compact,
}: {
  conversation: DemoMessage;
  /** The booking request the conversation is about, when it is about one. */
  appointment?: DemoAppointment;
  onSend: (conversationId: string, text: string) => void;
  /** Answering the request from inside its conversation; left out, its details are read-only. */
  onConfirm?: (id: string) => void;
  onDecline?: (id: string) => void;
  onRebook?: (appointment: DemoAppointment) => void;
  /**
   * Shows the booking somewhere else — the inbox gives it a column of its own. Left out, the
   * booking opens in place of the messages, which is all the narrow side panel has room for.
   */
  onOpenDetails?: () => void;
  /** Whether that column is showing this conversation's booking, so the strip can say so. */
  detailsOpen?: boolean;
  /** The side panel: the thread shown whole, never scrolling inside. */
  compact?: boolean;
}) {
  // Which conversation has its booking open, rather than a flag: moving to another
  // conversation goes back to its messages instead of carrying the open booking along.
  const [bookingOpenFor, setBookingOpenFor] = useState<string | null>(null);

  if (appointment && bookingOpenFor === conversation.id) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <button
          type="button"
          onClick={() => setBookingOpenFor(null)}
          className="mb-4 inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-brand-500 hover:underline"
        >
          <ArrowLeft className="size-3.5" />
          Back to messages
        </button>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <AppointmentDetail
            appointment={appointment}
            onConfirm={onConfirm}
            onDecline={onDecline}
            onRebook={onRebook}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {appointment && (
        <RequestChip
          appointment={appointment}
          active={detailsOpen}
          onOpen={onOpenDetails ?? (() => setBookingOpenFor(conversation.id))}
        />
      )}

      <ol
        aria-label={`Conversation with ${conversation.customerName}`}
        // In the side panel the whole thread shows and the page scrolls; in the inbox's fixed
        // height it fills what is left and scrolls inside.
        className={cn("flex flex-1 flex-col gap-3 py-4", !compact && "overflow-y-auto")}
      >
        {conversation.thread.map((message) => (
          <li
            key={message.id}
            className={cn("flex max-w-[85%] flex-col gap-1", message.from === "pro" ? "items-end self-end" : "items-start")}
          >
            <div
              className={cn(
                "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                message.from === "pro"
                  ? "rounded-br-md bg-brand text-white"
                  : "rounded-bl-md bg-brand-50 text-foreground",
                message.kind === "request" && "border border-amber-500/30 bg-amber-500/5",
                message.kind === "booking" && "border border-go/30 bg-go-bg text-foreground"
              )}
            >
              {message.kind === "request" && (
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                  Booking request
                </p>
              )}
              {message.kind === "booking" && (
                <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-[#07734F]">
                  <CircleCheck className="size-3" />
                  Appointment confirmed
                </p>
              )}
              <p className="whitespace-pre-line">{message.text}</p>
              {message.kind === "booking" && (
                <p className="mt-1.5 text-[11px] text-muted-ink">Sent by email, with the appointment for their calendar.</p>
              )}
            </div>
            {/* The page is built on the server and read on the client a moment later, so a
                "Today, 9:14 AM" can differ between the two by the minute it took. */}
            <time dateTime={message.sentAt.toISOString()} suppressHydrationWarning className="px-1 text-[11px] text-faint">
              {message.from === "pro" ? "You" : conversation.customerName.split(" ")[0]} · {messageTime(message.sentAt)}
            </time>
          </li>
        ))}
      </ol>

      {prefersPhone(appointment) && <PhonePreference appointment={appointment} />}

      {/* Keyed on the conversation so a half-written reply stays with the one it was written for
          rather than following the pointer to the next. */}
      <ReplyBox key={conversation.id} conversation={conversation} onSend={onSend} />
    </div>
  );
}

const CHIP_LABEL: Record<DemoAppointment["status"], string> = {
  pending: "Requested",
  confirmed: "Confirmed",
  declined: "Declined",
  cancelled: "Cancelled",
};

/** The request the conversation is about, in a line — and the way into all of it. */
function RequestChip({
  appointment,
  onOpen,
  active,
}: {
  appointment: DemoAppointment;
  onOpen: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-pressed={active}
      aria-label={`Booking details: ${appointment.service}, ${format(appointment.date, "EEEE, MMMM d")} at ${appointment.time}`}
      className={cn(
        "group flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs text-muted-ink transition-colors hover:border-brand-100 hover:bg-brand-50/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        active ? "border-brand-100 bg-brand-50/60" : "border-line bg-white"
      )}
    >
      <CalendarDays className="size-3.5 shrink-0 text-brand-500" />
      <span className="min-w-0 truncate">
        About <span className="font-semibold text-brand">{appointment.service}</span> ·{" "}
        {format(appointment.date, "EEE, MMM d")} at {appointment.time}
      </span>
      <span className={cn("ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold", STATUS_TONE[appointment.status])}>
        {CHIP_LABEL[appointment.status]}
      </span>
      <span className="flex shrink-0 items-center gap-0.5 font-semibold text-brand-500">
        Details
        <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </button>
  );
}

/**
 * Said where the reply is written, because that is where it is easy to forget: the customer asked
 * to be called. A message still goes out by email, but on its own it is not the answer they are
 * waiting for.
 */
function PhonePreference({ appointment }: { appointment: DemoAppointment }) {
  const firstName = appointment.customerName.split(" ")[0];

  return (
    <div className="mb-2 flex items-center gap-2.5 rounded-xl border border-brand-100 bg-brand-50 px-3 py-2 text-xs text-brand">
      <Phone className="size-3.5 shrink-0 text-brand-500" />
      <p className="min-w-0 flex-1">
        <span className="font-semibold">{firstName} prefers a phone call</span>
        <span className="text-muted-ink"> · {appointment.phone}</span>
      </p>
      <a
        href={telHref(appointment.phone)}
        className="shrink-0 rounded-full bg-brand px-3 py-1 text-[11px] font-semibold text-white hover:bg-brand/90"
      >
        Call
      </a>
    </div>
  );
}

/** How tall the box may grow before it scrolls instead: about six lines. */
const REPLY_MAX_HEIGHT = 144;

function ReplyBox({
  conversation,
  onSend,
}: {
  conversation: DemoMessage;
  onSend: (conversationId: string, text: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const box = useRef<HTMLTextAreaElement>(null);
  const firstName = conversation.customerName.split(" ")[0];
  const canSend = draft.trim() !== "";

  const send = () => {
    if (!canSend) return;
    onSend(conversation.id, draft.trim());
    setDraft("");
    // Back to one line: the height was set by hand while typing, and clearing the text does not.
    if (box.current) box.current.style.height = "auto";
  };

  return (
    <div className="border-t border-line pt-3">
      {/* One line to start, the button beside it; it grows with what is typed, up to a limit. */}
      <div className="flex items-end gap-2 rounded-2xl border border-line bg-white py-1.5 pr-1.5 pl-3.5 focus-within:border-brand-100 focus-within:ring-2 focus-within:ring-brand-500/20">
        <textarea
          ref={box}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            // Measured from nothing, so it shrinks again when lines are deleted.
            e.target.style.height = "auto";
            e.target.style.height = `${Math.min(e.target.scrollHeight, REPLY_MAX_HEIGHT)}px`;
          }}
          onKeyDown={(e) => {
            // Enter is a new line, as in any email; the modifier sends, as in most mail apps.
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          aria-label={`Reply to ${conversation.customerName}`}
          // Says where it goes, which matters most beside a customer who asked for a call instead.
          placeholder={`Reply to ${firstName} by email…`}
          className="block max-h-36 min-h-8 flex-1 resize-none bg-transparent py-1.5 text-sm leading-5 outline-none placeholder:text-faint"
        />
        <Button
          size="sm"
          onClick={send}
          disabled={!canSend}
          className="h-8 shrink-0 gap-1.5 rounded-full px-3.5 text-xs font-semibold"
        >
          <Send className="size-3.5" />
          Send
        </Button>
      </div>
    </div>
  );
}

/** A conversation with one more message from the tradesperson on the end. */
export function withReply(conversation: DemoMessage, text: string): DemoMessage {
  return {
    ...conversation,
    thread: [
      ...conversation.thread,
      { id: `${conversation.id}-${conversation.thread.length + 1}`, from: "pro", text, sentAt: new Date() },
    ],
  };
}
