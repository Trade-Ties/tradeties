"use client";

import { useState } from "react";
import { CalendarPlus, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { BookedNotice } from "../BookedNotice";
import { prefillForConversation, withConfirmation, type BookingPrefill, type NewBooking } from "../booking";
import { Conversation, withReply } from "../Conversation";
import { NewEntryDialog } from "../NewEntryDialog";
import { knownCustomers, latestMessage, type DemoAppointment, type DemoMessage } from "../demo-data";
import { listTime } from "../messageTime";

export type InboxFilter = "all" | "unread";

export function InboxView({
  messages: initial,
  appointments: initialAppointments,
  initialFilter = "all",
  initialConversationId,
}: {
  messages: DemoMessage[];
  /** For naming the booking request a conversation is about. */
  appointments: DemoAppointment[];
  initialFilter?: InboxFilter;
  /** A conversation a link asked to open, e.g. from the dashboard's side panel. */
  initialConversationId?: string;
}) {
  const [messages, setMessages] = useState(() =>
    // Opened by a link counts as read, the same as opened by a click.
    initial.map((m) => (m.id === initialConversationId ? { ...m, unread: false } : m))
  );
  const [filter, setFilter] = useState<InboxFilter>(initialFilter);
  const [selectedId, setSelectedId] = useState<string | undefined>(
    initial.some((m) => m.id === initialConversationId)
      ? initialConversationId
      : (initialFilter === "unread" ? initial.find((m) => m.unread) : initial[0])?.id
  );

  // The answered conversation moves to the top: the list is newest first.
  const [appointments, setAppointments] = useState(initialAppointments);
  const [booking, setBooking] = useState<{ open: boolean; prefill?: BookingPrefill; key: number }>({
    open: false,
    key: 0,
  });
  const [notice, setNotice] = useState<string | null>(null);

  /** Booked from a conversation: over the request it replaces, and confirmed in the conversation. */
  const addAppointment = ({ appointment, notify, replacesId }: NewBooking) => {
    const id = `a${Date.now()}`;
    setAppointments((prev) => [...prev.filter((a) => a.id !== replacesId), { ...appointment, id }]);
    if (notify) {
      const conversations = withConfirmation(messages, id, appointment);
      setMessages(conversations);
      setSelectedId(conversations[0].id);
      setNotice(`Booked — a confirmation is on its way to ${appointment.email}.`);
    } else {
      setNotice("Booked.");
    }
  };

  const send = (conversationId: string, text: string) =>
    setMessages((prev) => {
      const answered = prev.find((m) => m.id === conversationId);
      return answered === undefined
        ? prev
        : [withReply(answered, text), ...prev.filter((m) => m.id !== conversationId)];
    });

  const select = (m: DemoMessage) => {
    setSelectedId(m.id);
    setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, unread: false } : x)));
  };

  const selected = messages.find((m) => m.id === selectedId);
  const unreadCount = messages.filter((m) => m.unread).length;
  // The open message stays in the unread list after opening it has marked it read, so it does
  // not vanish from under the pointer; it drops out once another one is picked.
  const listed = filter === "all" ? messages : messages.filter((m) => m.unread || m.id === selectedId);

  return (
    <>
      {notice && <BookedNotice onDismiss={() => setNotice(null)}>{notice}</BookedNotice>}

      <NewEntryDialog
        key={booking.key}
        open={booking.open}
        onOpenChange={(open) => setBooking((b) => ({ ...b, open }))}
        day={new Date(new Date().setHours(0, 0, 0, 0))}
        customers={knownCustomers(appointments)}
        prefill={booking.prefill}
        // Opened from a conversation it is always an appointment, which the form knows from the
        // prefill; the entry side is never reached.
        onAddEntry={() => {}}
        onAddAppointment={addAppointment}
      />

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[380px_1fr]">
        <Card className="gap-0 rounded-3xl border border-line bg-white py-2 shadow-card">
          <div role="tablist" aria-label="Show" className="mx-2 mb-2 mt-1 flex gap-1 rounded-full bg-brand-50 p-1">
            <FilterTab active={filter === "all"} onClick={() => setFilter("all")}>
              All
            </FilterTab>
            <FilterTab active={filter === "unread"} onClick={() => setFilter("unread")}>
              Unread{unreadCount > 0 && ` (${unreadCount})`}
            </FilterTab>
          </div>
          <CardContent className="flex flex-col gap-1 px-2">
            {listed.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-muted-ink">
                {filter === "unread" ? "You're all caught up — nothing unread." : "No messages yet."}
              </p>
            )}
            {listed.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => select(m)}
                className={cn(
                  "flex w-full flex-col gap-0.5 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-brand-50",
                  m.id === selectedId && "bg-brand-50"
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={
                      m.unread
                        ? "size-1.5 shrink-0 rounded-full bg-brand-500"
                        : "size-1.5 shrink-0 rounded-full bg-transparent"
                    }
                  />
                  <p className={m.unread ? "truncate text-sm font-semibold" : "truncate text-sm font-medium"}>
                    {m.customerName}
                  </p>
                  <time
                    dateTime={latestMessage(m).sentAt.toISOString()}
                    suppressHydrationWarning
                    className="ml-auto shrink-0 text-[11px] text-faint"
                  >
                    {listTime(latestMessage(m).sentAt)}
                  </time>
                </div>
                <p className="truncate pl-3.5 text-xs text-muted-ink">
                  {latestMessage(m).from === "pro" && "You: "}
                  {latestMessage(m).text}
                </p>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="gap-4 rounded-3xl border border-line bg-white py-0 shadow-card lg:sticky lg:top-4">
          <CardContent className="flex h-[min(640px,calc(100dvh-8rem))] flex-col px-6 py-6">
            {selected ? (
              <>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="text-xl font-bold tracking-[-0.01em] text-brand">{selected.customerName}</h2>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setBooking((b) => ({
                        open: true,
                        prefill: prefillForConversation(selected, appointments),
                        key: b.key + 1,
                      }))
                    }
                    className="h-8 shrink-0 gap-1.5 rounded-full border-line px-3.5 text-xs font-semibold text-muted-ink hover:bg-brand-50 hover:text-brand-500"
                  >
                    <CalendarPlus className="size-3.5" />
                    Book appointment
                  </Button>
                </div>
                <Conversation
                  conversation={selected}
                  appointment={appointments.find((a) => a.id === selected.appointmentId)}
                  onSend={send}
                />
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-muted-ink">
                <Mail className="size-6" />
                <p className="text-sm">Select a conversation to read it.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function FilterTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
        active ? "bg-white text-brand shadow-sm" : "text-muted-ink hover:text-brand"
      )}
    >
      {children}
    </button>
  );
}
