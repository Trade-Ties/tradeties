import { Inbox } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DemoMessage } from "./demo-data";

export function DashboardInbox({
  messages,
  onSelect,
  selectedId,
}: {
  messages: DemoMessage[];
  onSelect: (message: DemoMessage) => void;
  /** id of the message currently open in the detail panel, if any. */
  selectedId?: string;
}) {
  const unreadCount = messages.filter((m) => m.unread).length;

  return (
    <Card className="gap-4 rounded-3xl border border-line bg-white py-0 shadow-card">
      <CardHeader className="px-5 pt-5">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Inbox className="size-4 text-brand-500" />
          Inbox
          {unreadCount > 0 && (
            <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-brand text-[11px] font-semibold text-white">
              {unreadCount}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        {messages.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line py-6 text-center text-sm text-muted-ink">
            No messages yet.
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            {messages.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onSelect(m)}
                className={cn(
                  "flex w-full items-start gap-2.5 rounded-2xl px-2.5 py-2.5 text-left transition-colors hover:bg-brand-50",
                  m.id === selectedId && "bg-brand-50 ring-2 ring-brand-500"
                )}
              >
                <span
                  className={
                    m.unread
                      ? "mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-500"
                      : "mt-1.5 size-1.5 shrink-0 rounded-full bg-transparent"
                  }
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className={m.unread ? "truncate text-sm font-semibold" : "truncate text-sm font-medium"}>
                      {m.customerName}
                    </p>
                    <span className="shrink-0 text-[11px] text-faint">{m.receivedLabel}</span>
                  </div>
                  <p className="truncate text-xs text-muted-ink">{m.preview}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
