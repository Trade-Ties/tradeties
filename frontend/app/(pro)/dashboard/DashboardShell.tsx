"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

import { DashboardCalendar } from "./DashboardCalendar";
import { DashboardInbox } from "./DashboardInbox";
import { DetailPanel, type Selection } from "./DetailPanel";
import type { DemoAppointment, DemoMessage } from "./demo-data";

/**
 * Owns the interactive state for the dashboard: appointment statuses,
 * message read state, and which item (if any) is open in the detail panel.
 * `children` is the server-rendered header/banner/stats above this — passed
 * through untouched so the page's max-width can react to whether the panel
 * is open without those parts needing any client state of their own.
 */
export function DashboardShell({
  appointments: initialAppointments,
  messages: initialMessages,
  children,
}: {
  appointments: DemoAppointment[];
  messages: DemoMessage[];
  children: React.ReactNode;
}) {
  const [appointments, setAppointments] = useState(initialAppointments);
  const [messages, setMessages] = useState(initialMessages);
  const [selection, setSelection] = useState<Selection | null>(null);

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

      <div className="flex items-start gap-4">
        <div
          className={cn(
            "grid min-w-0 flex-1 grid-cols-1 gap-4 transition-all duration-300",
            selection ? "lg:grid-cols-2" : "lg:grid-cols-[1.4fr_1fr]"
          )}
        >
          <DashboardCalendar
            appointments={appointments}
            onConfirm={confirm}
            onDecline={decline}
            onSelect={selectAppointment}
            selectedId={selection?.type === "appointment" ? selection.item.id : undefined}
          />
          <DashboardInbox
            messages={messages}
            onSelect={selectMessage}
            selectedId={selection?.type === "message" ? selection.item.id : undefined}
          />
        </div>

        {selection && <DetailPanel selection={selection} onClose={() => setSelection(null)} onConfirm={confirm} onDecline={decline} />}
      </div>
    </div>
  );
}
