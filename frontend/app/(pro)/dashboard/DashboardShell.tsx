"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

import { DashboardCalendar } from "./DashboardCalendar";
import { DashboardInbox } from "./DashboardInbox";
import { withReply } from "./Conversation";
import { BookedNotice } from "./BookedNotice";
import {
  prefillForConversation,
  prefillFrom,
  withConfirmation,
  type BookingPrefill,
  type NewBooking,
} from "./booking";
import { DetailPanel, type Selection } from "./DetailPanel";
import {
  knownCustomers,
  type CalendarEntry,
  type DemoAppointment,
  type DemoMessage,
  type TimeOff,
} from "./demo-data";
import { NewEntryDialog } from "./NewEntryDialog";

/**
 * Owns the interactive state for the dashboard: appointment statuses,
 * message read state, and which item (if any) is open in the detail panel.
 * `children` is the server-rendered header/banner/stats above this — passed
 * through untouched so the page's max-width can react to whether the panel
 * is open without those parts needing any client state of their own.
 */
export function DashboardShell({
  appointments: initialAppointments,
  entries: initialEntries,
  timeOff: initialTimeOff,
  messages: initialMessages,
  children,
}: {
  appointments: DemoAppointment[];
  entries: CalendarEntry[];
  timeOff: TimeOff[];
  messages: DemoMessage[];
  children: React.ReactNode;
}) {
  const [appointments, setAppointments] = useState(initialAppointments);
  const [entries, setEntries] = useState(initialEntries);
  const [timeOff, setTimeOff] = useState(initialTimeOff);
  const [messages, setMessages] = useState(initialMessages);
  const [selection, setSelection] = useState<Selection | null>(null);

  // The booking form: whether it is open, who it is for when started from a request or a
  // conversation, and a key bumped per opening so it starts afresh.
  const [booking, setBooking] = useState<{ open: boolean; prefill?: BookingPrefill; key: number }>({
    open: false,
    key: 0,
  });
  const [notice, setNotice] = useState<string | null>(null);

  const openBooking = (prefill?: BookingPrefill) => setBooking((b) => ({ open: true, prefill, key: b.key + 1 }));

  /**
   * An appointment the tradesperson booked: into the calendar, over the request it replaces, and
   * — when they chose to — confirmed to the customer in their conversation, which is what emails
   * it to them. The open panel moves to what was just booked.
   */
  const addAppointment = ({ appointment, notify, replacesId }: NewBooking) => {
    const booked: DemoAppointment = { ...appointment, id: `a${Date.now()}` };
    setAppointments((prev) => [...prev.filter((a) => a.id !== replacesId), booked]);

    if (notify) {
      const conversations = withConfirmation(messages, booked.id, appointment);
      setMessages(conversations);
      setSelection({ type: "message", item: conversations[0] });
      setNotice(`Booked — a confirmation is on its way to ${appointment.email}.`);
    } else {
      setSelection({ type: "appointment", item: booked });
      setNotice("Booked.");
    }
  };

  const addEntry = (entry: Omit<CalendarEntry, "id">) => setEntries((prev) => [...prev, { ...entry, id: `e${Date.now()}` }]);
  const addTimeOff = (off: Omit<TimeOff, "id">) => setTimeOff((prev) => [...prev, { ...off, id: `t${Date.now()}` }]);

  const confirm = (id: string) => {
    setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status: "confirmed" as const } : a)));
    setSelection((sel) =>
      sel?.type === "appointment" && sel.item.id === id
        ? { type: "appointment", item: { ...sel.item, status: "confirmed" } }
        : sel
    );
  };

  const decline = (id: string) => {
    setAppointments((prev) => prev.filter((a) => a.id !== id));
    setSelection((sel) => (sel?.type === "appointment" && sel.item.id === id ? null : sel));
  };

  const selectAppointment = (appointment: DemoAppointment) => setSelection({ type: "appointment", item: appointment });

  // The answered conversation moves to the top, and the open panel follows it: the selection is a
  // copy, so it is replaced along with the row.
  const reply = (conversationId: string, text: string) => {
    const answered = messages.find((m) => m.id === conversationId);
    if (answered === undefined) return;

    const updated = withReply(answered, text);
    setMessages((prev) => [updated, ...prev.filter((m) => m.id !== conversationId)]);
    setSelection((sel) => (sel?.type === "message" && sel.item.id === conversationId ? { type: "message", item: updated } : sel));
  };

  const selectMessage = (message: DemoMessage) => {
    setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, unread: false } : m)));
    setSelection({ type: "message", item: { ...message, unread: false } });
  };

  return (
    <div
      className={cn(
        "mx-auto w-full px-8 py-10 transition-[max-width] duration-300",
        selection ? "max-w-6xl" : "max-w-5xl"
      )}
    >
      {children}

      {notice && <BookedNotice onDismiss={() => setNotice(null)}>{notice}</BookedNotice>}

      <NewEntryDialog
        key={booking.key}
        open={booking.open}
        onOpenChange={(open) => setBooking((b) => ({ ...b, open }))}
        day={new Date(new Date().setHours(0, 0, 0, 0))}
        customers={knownCustomers(appointments)}
        prefill={booking.prefill}
        appointments={appointments}
        onAddEntry={addEntry}
        onAddAppointment={addAppointment}
        onAddTimeOff={addTimeOff}
      />

      <div className="flex items-start gap-4">
        <div
          className={cn(
            "grid min-w-0 flex-1 grid-cols-1 gap-4 transition-all duration-300",
            selection ? "lg:grid-cols-2" : "lg:grid-cols-[1.4fr_1fr]"
          )}
        >
          <DashboardCalendar
            appointments={appointments}
            entries={entries}
            timeOff={timeOff}
            onConfirm={confirm}
            onDecline={decline}
            onSelect={selectAppointment}
            onNew={() => openBooking()}
            selectedId={selection?.type === "appointment" ? selection.item.id : undefined}
          />
          <DashboardInbox
            messages={messages}
            onSelect={selectMessage}
            selectedId={selection?.type === "message" ? selection.item.id : undefined}
          />
        </div>

        {selection && (
          <DetailPanel
            selection={selection}
            onClose={() => setSelection(null)}
            onConfirm={confirm}
            onDecline={decline}
            onReply={reply}
            onRebook={(request) => openBooking(prefillFrom(request))}
            onBook={(conversation) => openBooking(prefillForConversation(conversation, appointments))}
            appointments={appointments}
          />
        )}
      </div>
    </div>
  );
}
