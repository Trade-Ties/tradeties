"use client";

import { useActionState, useEffect, useRef } from "react";
import { Send } from "lucide-react";

import { Button } from "@/components/ui/button";

import type { SendState } from "./actions";

/**
 * The customer's reply box. The action it is handed already carries the token and the request,
 * bound on the server; this form contributes the text and nothing else.
 */
export function ReplyForm({
  action,
  businessName,
}: {
  action: (previous: SendState, form: FormData) => Promise<SendState>;
  businessName: string;
}) {
  const [state, submit, pending] = useActionState(action, { status: "idle" });
  const form = useRef<HTMLFormElement>(null);

  // Cleared once it went, not before: a failed send keeps what was written.
  useEffect(() => {
    if (state.status === "sent") form.current?.reset();
  }, [state]);

  return (
    <form ref={form} action={submit} className="mt-4">
      <label htmlFor="reply" className="sr-only">
        Message to {businessName}
      </label>
      <div className="flex items-end gap-2 rounded-2xl border border-line bg-white py-1.5 pr-1.5 pl-3.5 focus-within:border-brand-100 focus-within:ring-2 focus-within:ring-brand-500/20">
        <textarea
          id="reply"
          name="body"
          rows={2}
          maxLength={5000}
          required
          placeholder={`Write to ${businessName}…`}
          className="block min-h-10 flex-1 resize-y bg-transparent py-1.5 text-[14px] leading-5 outline-none placeholder:text-faint"
        />
        <Button type="submit" size="sm" disabled={pending} className="h-8 shrink-0 gap-1.5 rounded-full px-3.5 text-xs font-semibold">
          <Send className="size-3.5" />
          {pending ? "Sending…" : "Send"}
        </Button>
      </div>
      {state.status === "failed" && <p className="mt-2 text-[13px] text-destructive">{state.message}</p>}
      {state.status === "sent" && (
        <p className="mt-2 text-[13px] text-muted-ink">Sent. {businessName} gets an email about it.</p>
      )}
    </form>
  );
}
