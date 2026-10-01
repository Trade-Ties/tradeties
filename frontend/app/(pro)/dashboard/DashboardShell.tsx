"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

import { DashboardCalendar } from "./DashboardCalendar";
import { DashboardInbox } from "./DashboardInbox";
import { withReply } from "./Conversation";
import { asSentence, BookedNotice } from "./BookedNotice";
import type { StoredTimeOff } from "./blocks";
import {
  prefillForConversation,
  prefillFrom,
  withConfirmation,
  type BookingPrefill,
  type BookResult,
  type NewBooking,
  type ServiceOption,
} from "./booking";
import { acceptRequest, declineRequest } from "./actions";
import { openConversation, replyToCustomer } from "./inbox/actions";
import { appointmentOf, threadOf } from "./inbox/live";
import { DeclineDialog } from "./DeclineDialog";
import { DetailPanel, type Selection } from "./DetailPanel";
import type { IncomingRequest } from "./requests";
import { knownCustomers, type AppointmentStatus, type DemoAppointment, type DemoMessage } from "./demo-data";
import { NewEntryDialog, type Editing } from "./NewEntryDialog";
import { useCalendarWrites } from "./useCalendarWrites";

/**
 * Owns the interactive state for the dashboard: appointment statuses,
 * message read state, and which item (if any) is open in the detail panel.
 * `children` is the server-rendered header/banner/stats above this — passed
 * through untouched so the page's max-width can react to whether the panel
 * is open without those parts needing any client state of their own.
 */
export function DashboardShell({
  requests,
  blocks,
  services,
  messages: initialMessages,
  overSchedule,
  overInbox,
  children,
}: {
  requests: IncomingRequest[];
  blocks: StoredTimeOff[];
  services: ServiceOption[];
  messages: DemoMessage[];
  /** The tile above the schedule, as wide as it. */
  overSchedule: React.ReactNode;
  /** The tiles above the inbox, sharing its width. */
  overInbox: React.ReactNode;
  children: React.ReactNode;
}) {
  const writes = useCalendarWrites(requests, blocks);
  const { appointments, setAppointments } = writes;

  // What a refused answer left to say, and whether re-reading is the move.
  const [refusal, setRefusal] = useState<{ message: string; gone: boolean } | null>(null);
  const [declining, setDeclining] = useState<DemoAppointment | null>(null);
  const [messages, setMessages] = useState(initialMessages);
  const [selection, setSelection] = useState<Selection | null>(null);

  // The form: whether it is open, who it is for when started from a request or a conversation,
  // what it changes when it was opened on something, and a key bumped per opening so it starts
  // afresh.
  const [form, setForm] = useState<{ open: boolean; prefill?: BookingPrefill; editing?: Editing; key: number }>({
    open: false,
    key: 0,
  });
  const [notice, setNotice] = useState<string | null>(null);

  const openForm = (prefill?: BookingPrefill, editing?: Editing) =>
    setForm((f) => ({ open: true, prefill, editing, key: f.key + 1 }));

  /**
   * An appointment the tradesperson booked or changed: into the calendar once the server has
   * written it, over the request it replaces, and — when they chose to — confirmed to the customer
   * in their conversation. The open panel moves to what was just booked.
   */
  const book = async (booking: NewBooking): Promise<BookResult> => {
    const changing = form.editing?.kind === "appointment" ? form.editing.appointment.id : undefined;
    const result = await writes.book(booking, changing);

    if (result.kind !== "saved") return result;

    if (!changing && booking.notify) {
      const conversations = withConfirmation(messages, result.booked.id, booking.appointment);
      setMessages(conversations);
      setSelection({ type: "message", item: conversations[0] });
      setNotice(`Booked — a confirmation is on its way to ${booking.appointment.email}.`);
    } else {
      setSelection({ type: "appointment", item: result.booked });
      setNotice(changing ? "Saved." : "Booked.");
    }
    return { kind: "saved" };
  };

  const removeBooked = async (id: string) => {
    const message = await writes.removeAppointment(id);

    if (message !== null) {
      setRefusal({ message, gone: false });
      return;
    }

    setSelection((sel) => (sel?.type === "appointment" && sel.item.id === id ? null : sel));
    settle(id, "cancelled");
    setNotice("Removed from your calendar.");
  };

  /**
   * Taking the job is the one action here that can be refused, and the refusal matters: the hour
   * may have gone while this page sat open. Nothing moves on screen until the server says it was
   * written, because a row that flipped to confirmed and then did not would be the worst of it.
   */
  const confirm = async (id: string) => {
    const answer = await acceptRequest(id);

    if (!answer.ok) {
      setRefusal(answer);
      return;
    }

    setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status: "confirmed" as const } : a)));
    setSelection((sel) =>
      sel?.type === "appointment" && sel.item.id === id
        ? { type: "appointment", item: { ...sel.item, status: "confirmed" } }
        : sel
    );
    settle(id, "confirmed");
  };

  /**
   * Turning a job down asks for a reason, if they want to give one, so the button opens the box rather than doing it. The row
   * only leaves the list once the server has actually written the refusal.
   */
  const decline = (id: string) => {
    const request = appointments.find((a) => a.id === id);
    if (request) {
      setDeclining(request);
    }
  };

  const sendDecline = async (id: string, reason: string) => {
    const answer = await declineRequest(id, reason);

    if (!answer.ok) {
      setRefusal(answer);
      return;
    }

    setDeclining(null);
    setAppointments((prev) => prev.filter((a) => a.id !== id));
    setSelection((sel) => (sel?.type === "appointment" && sel.item.id === id ? null : sel));
    settle(id, "declined", reason || undefined);
  };

  const selectAppointment = (appointment: DemoAppointment) => setSelection({ type: "appointment", item: appointment });

  // Sent for real, as from the full inbox. Shown at once — the conversation moves to the top and
  // the open panel follows it — and taken back with a note if it did not go.
  const reply = async (conversationId: string, text: string) => {
    const answered =
      (selection?.type === "message" && selection.item.id === conversationId ? selection.item : undefined) ??
      messages.find((m) => m.id === conversationId);
    if (answered === undefined) return;

    const updated = withReply(answered, text);
    setMessages((prev) => [updated, ...prev.filter((m) => m.id !== conversationId)]);
    setSelection((sel) => (sel?.type === "message" && sel.item.id === conversationId ? { ...sel, item: updated } : sel));

    const failed = await replyToCustomer(conversationId, text);
    if (failed) {
      setMessages((prev) => prev.map((m) => (m.id === conversationId ? answered : m)));
      setSelection((sel) => (sel?.type === "message" && sel.item.id === conversationId ? { ...sel, item: answered } : sel));
      setRefusal({ message: failed, gone: false });
    }
  };

  // The panel opens at once on what the card holds — the latest line — and fills with the whole
  // conversation when it arrives; opening it is reading it.
  const selectMessage = async (message: DemoMessage) => {
    setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, unread: false } : m)));
    setSelection({ type: "message", item: { ...message, unread: false } });

    const whole = await openConversation(message.id);
    if (whole === null) return;
    setSelection((sel) =>
      sel?.type === "message" && sel.item.id === message.id
        ? { type: "message", item: threadOf(whole), request: appointmentOf(whole) }
        : sel
    );
  };

  /** How a request ended, carried into the open conversation's chip — it no longer has a row to follow. */
  const settle = (id: string, status: AppointmentStatus, declineReason?: string) =>
    setSelection((sel) =>
      sel?.type === "message" && sel.request?.id === id
        ? { ...sel, request: { ...sel.request, status, declineReason } }
        : sel
    );

  return (
    <div
      // As wide as every other tab, panel open or not: the grid makes room for the panel by
      // narrowing, rather than the page growing under the reader's pointer.
      className="mx-auto w-full max-w-7xl px-8 py-10"
    >
      {children}

      {notice && <BookedNotice onDismiss={() => setNotice(null)}>{notice}</BookedNotice>}

      {refusal && (
        <BookedNotice tone="warning" onDismiss={() => setRefusal(null)}>
          {asSentence(refusal.message)}
          {refusal.gone && " Reload to see what is still open."}
        </BookedNotice>
      )}

      <DeclineDialog
        key={declining?.id ?? "none"}
        request={declining}
        onOpenChange={(open) => !open && setDeclining(null)}
        onDecline={sendDecline}
      />

      <NewEntryDialog
        key={form.key}
        open={form.open}
        onOpenChange={(open) => setForm((f) => ({ ...f, open }))}
        day={new Date(new Date().setHours(0, 0, 0, 0))}
        customers={knownCustomers(appointments)}
        services={services}
        prefill={form.prefill}
        editing={form.editing}
        onBook={book}
        onSaveTimeOff={(input) =>
          writes.saveTimeOff(input, form.editing?.kind === "timeOff" ? form.editing.block : undefined)
        }
      />

      {/*
        The tiles over the cards in the same two columns, and the panel, when open, beside both —
        from the top of the tiles to the bottom of the cards, every card ending level with it.

        Without the panel the row is as tall as its tallest card, up to the window's height, past
        which the cards scroll inside. With it, the panel is shown whole and sets the height — the
        page scrolls, never the panel — and the cards stretch to it, their lists scrolling inside
        rather than making the row taller (see `group-data-[panel=open]` in the two cards).
      */}
      <div
        data-panel={selection ? "open" : undefined}
        className={cn(
          "group/row flex items-start gap-4 lg:items-stretch",
          !selection && "lg:max-h-[calc(100dvh-4rem)]"
        )}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-4 lg:min-h-0">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-4">
            {overSchedule}
            <div className="grid grid-cols-1 gap-3 min-[560px]:grid-cols-2 lg:gap-4">{overInbox}</div>
          </div>
          <div
            className={cn(
              "grid min-w-0 grid-cols-1 gap-4 transition-all duration-300 lg:min-h-0 lg:flex-1",
              // However short the panel, room for a few rows in each list.
              selection && "lg:min-h-[26rem]",
              // Schedule and inbox the same width, panel open or not, so the two cards read as a pair.
              "lg:grid-cols-2"
            )}
          >
            <DashboardCalendar
              appointments={appointments}
              entries={writes.entries}
              timeOff={writes.timeOff}
              onConfirm={confirm}
              onDecline={decline}
              onSelect={selectAppointment}
              onNew={() => openForm()}
              selectedId={selection?.type === "appointment" ? selection.item.id : undefined}
            />
            <DashboardInbox
              messages={messages}
              onSelect={selectMessage}
              selectedId={selection?.type === "message" ? selection.item.id : undefined}
            />
          </div>
        </div>

        {selection && (
          <DetailPanel
            selection={selection}
            onClose={() => setSelection(null)}
            onConfirm={confirm}
            onDecline={decline}
            onReply={reply}
            onRebook={(request) => openForm(prefillFrom(request))}
            onBook={(conversation) => openForm(prefillForConversation(conversation, appointments))}
            onChange={(appointment) => openForm(undefined, { kind: "appointment", appointment })}
            onRemove={removeBooked}
            appointments={appointments}
            className="lg:flex lg:w-[360px] lg:flex-col"
            boxClassName="lg:static lg:flex lg:flex-1 lg:flex-col"
          />
        )}
      </div>
    </div>
  );
}
