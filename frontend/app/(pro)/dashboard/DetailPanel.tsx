import Link from "next/link";
import { CalendarPlus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { inboxConversationPath } from "@/lib/routes";
import { cn } from "@/lib/utils";

import { AppointmentDetail } from "./AppointmentDetail";
import { Conversation } from "./Conversation";
import type { DemoAppointment, DemoMessage } from "./demo-data";

export type Selection =
  | { type: "appointment"; item: DemoAppointment }
  | { type: "message"; item: DemoMessage };

export function DetailPanel({
  selection,
  onClose,
  onConfirm,
  onDecline,
  onReply,
  onRebook,
  onBook,
  appointments = [],
  className = "lg:w-[360px]",
}: {
  selection: Selection;
  onClose: () => void;
  onConfirm: (id: string) => void;
  onDecline: (id: string) => void;
  /** Only needed where a conversation can be opened, which the calendar's panel never is. */
  onReply?: (conversationId: string, text: string) => void;
  /** Opens the booking form on this request's customer — for a time agreed another way. */
  onRebook?: (appointment: DemoAppointment) => void;
  /** Opens the booking form on a conversation's customer. */
  onBook?: (conversation: DemoMessage) => void;
  /** For naming the booking request a conversation is about. */
  appointments?: DemoAppointment[];
  /** Width at the breakpoints; the dashboard docks it beside the grid, the calendar in a column. */
  className?: string;
}) {
  return (
    <div className={cn("w-full shrink-0 duration-200 animate-in fade-in slide-in-from-right-4", className)}>
      <div className="sticky top-4 rounded-3xl border border-line bg-white p-5 shadow-lift">
        <div className="mb-4 flex items-start justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-faint">
            {selection.type === "appointment" ? "Appointment" : "Conversation"}
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
          <AppointmentDetail
            appointment={selection.item}
            onConfirm={onConfirm}
            onDecline={onDecline}
            onRebook={onRebook}
          />
        ) : (
          <MessageDetail
            conversation={selection.item}
            appointment={appointments.find((a) => a.id === selection.item.appointmentId)}
            onReply={onReply ?? (() => {})}
            onBook={onBook}
            onConfirm={onConfirm}
            onDecline={onDecline}
            onRebook={onRebook}
          />
        )}
      </div>
    </div>
  );
}

function MessageDetail({
  conversation,
  appointment,
  onReply,
  onBook,
  onConfirm,
  onDecline,
  onRebook,
}: {
  conversation: DemoMessage;
  appointment?: DemoAppointment;
  onReply: (conversationId: string, text: string) => void;
  onBook?: (conversation: DemoMessage) => void;
  onConfirm: (id: string) => void;
  onDecline: (id: string) => void;
  onRebook?: (appointment: DemoAppointment) => void;
}) {
  return (
    <div className="flex flex-col">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-xl font-bold tracking-[-0.01em] text-brand">{conversation.customerName}</h2>
        <Link
          href={inboxConversationPath(conversation.id)}
          className="shrink-0 text-xs font-semibold text-brand-500 hover:underline"
        >
          Open in inbox
        </Link>
      </div>
      <Conversation
        conversation={conversation}
        appointment={appointment}
        onSend={onReply}
        onConfirm={onConfirm}
        onDecline={onDecline}
        onRebook={onRebook}
        compact
      />
      {onBook && <BookButton onClick={() => onBook(conversation)} />}
    </div>
  );
}

/**
 * Books the customer a conversation is with — the usual end of agreeing a time with them, in the
 * messages or on the phone.
 */
export function BookButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="outline"
      onClick={onClick}
      className="mt-3 h-9 w-full gap-1.5 rounded-full border-line text-sm font-semibold text-muted-ink hover:bg-brand-50 hover:text-brand-500"
    >
      <CalendarPlus className="size-4" />
      Book appointment
    </Button>
  );
}
