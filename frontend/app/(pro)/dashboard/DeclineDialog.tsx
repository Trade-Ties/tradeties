"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import type { DemoAppointment } from "./demo-data";

/**
 * Why the job is being turned down.
 *
 * <p><strong>The reason is required, and that is a product decision rather than validation.</strong>
 * A refusal with nothing attached reads as a refusal of the person; "booked that morning already"
 * or "outside the area I cover" is the difference between a customer trying again and never
 * coming back. The backend insists on it too, so this box is where somebody finds that out
 * kindly.
 *
 * <p>Says plainly that the customer will read it, because a tradesperson writing a note to self
 * would word it differently.
 *
 * <p>Keyed by the caller on the request it is about, so the box starts empty each time it opens.
 * Clearing it in an effect instead would be a second render nobody sees and a reason that could
 * outlive the job it was typed for.
 */
export function DeclineDialog({
  request,
  onOpenChange,
  onDecline,
}: {
  request: DemoAppointment | null;
  onOpenChange: (open: boolean) => void;
  onDecline: (id: string, reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [pending, startSending] = useTransition();

  if (request === null) {
    return null;
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    startSending(async () => {
      await onDecline(request.id, reason.trim());
    });
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Turn this job down</DialogTitle>
          <DialogDescription>
            {request.customerName} · {request.service} · {format(request.date, "EEE, MMM d")} at{" "}
            {request.time}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="decline-reason" className="mb-1 block text-sm font-medium">
              Why?
            </Label>
            <Textarea
              id="decline-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              required
              maxLength={500}
              rows={3}
              placeholder="Booked that morning already — happy to look at another day."
              autoFocus
            />
            <p className="mt-1 text-xs text-muted-ink">
              {request.customerName} will be given this, so write it for them.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <DialogClose
              render={
                <Button type="button" variant="outline" disabled={pending}>
                  Keep it
                </Button>
              }
            />
            <Button type="submit" variant="destructive" disabled={pending || reason.trim() === ""}>
              {pending ? "Sending…" : "Decline"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
