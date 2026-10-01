"use client";

import { useEffect, useRef } from "react";
import { CircleCheck, TriangleAlert, X } from "lucide-react";

import { cn } from "@/lib/utils";

/** How long a "done" line stays before it goes by itself — long enough to read twice. */
const DONE_FOR_MS = 10_000;

/**
 * The line over the dashboard and the calendar that says how something went.
 *
 * "done" is green with a tick and leaves by itself: it only confirms what the screen already shows.
 * "warning" is amber and stays until it is closed — something did not happen, and the reader may
 * have looked away when it was said.
 */
export function BookedNotice({
  children,
  onDismiss,
  tone = "done",
}: {
  children: React.ReactNode;
  onDismiss: () => void;
  tone?: "done" | "warning";
}) {
  // The latest one, so a parent handing a fresh function each render does not restart the clock.
  const dismiss = useRef(onDismiss);
  useEffect(() => {
    dismiss.current = onDismiss;
  });

  useEffect(() => {
    if (tone !== "done") return;
    const timer = setTimeout(() => dismiss.current(), DONE_FOR_MS);
    return () => clearTimeout(timer);
  }, [tone, children]);

  const warning = tone === "warning";
  const Icon = warning ? TriangleAlert : CircleCheck;

  return (
    <div
      role={warning ? "alert" : "status"}
      className={cn(
        "mb-4 flex items-center gap-2.5 rounded-2xl border px-4 py-3 text-sm",
        warning ? "border-amber-500/30 bg-amber-50 text-amber-800" : "border-go/30 bg-go-bg text-[#07734F]"
      )}
    >
      <Icon className="size-4 shrink-0" />
      <p className="flex-1">{children}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className={cn(
          "grid size-6 shrink-0 place-items-center rounded-full",
          warning ? "hover:bg-amber-500/10" : "hover:bg-go/10"
        )}
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

/** A message from the server as a sentence, so what is added after it does not run on. */
export function asSentence(message: string): string {
  const text = message.trim();
  return /[.!?]$/.test(text) ? text : `${text}.`;
}
