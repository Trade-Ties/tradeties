"use client";

import { useState } from "react";
import { Mail } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import type { DemoMessage } from "../demo-data";

export function InboxView({ messages: initial }: { messages: DemoMessage[] }) {
  const [messages, setMessages] = useState(initial);
  const [selectedId, setSelectedId] = useState<string | undefined>(initial[0]?.id);

  const select = (m: DemoMessage) => {
    setSelectedId(m.id);
    setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, unread: false } : x)));
  };

  const selected = messages.find((m) => m.id === selectedId);

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[380px_1fr]">
      <Card className="gap-0 rounded-3xl border border-line bg-white py-2 shadow-card">
        <CardContent className="flex flex-col gap-1 px-2">
          {messages.map((m) => (
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
                <span className="ml-auto shrink-0 text-[11px] text-faint">{m.receivedLabel}</span>
              </div>
              <p className="truncate pl-3.5 text-xs text-muted-ink">{m.preview}</p>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card className="min-h-[420px] gap-4 rounded-3xl border border-line bg-white py-0 shadow-card">
        <CardContent className="flex h-full flex-col px-6 py-6">
          {selected ? (
            <>
              <h2 className="text-xl font-bold tracking-[-0.01em] text-brand">{selected.customerName}</h2>
              <p className="mt-1 text-xs text-faint">{selected.receivedLabel}</p>
              <p className="mt-5 max-w-prose text-sm leading-relaxed text-foreground">{selected.preview}</p>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-muted-ink">
              <Mail className="size-6" />
              <p className="text-sm">Select a message to read it.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
