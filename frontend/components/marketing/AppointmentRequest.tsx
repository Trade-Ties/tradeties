"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { CalendarDays } from "lucide-react";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DESCRIPTION_MAX } from "@/components/marketing/request-limits";
import { proPath } from "@/lib/routes";

/**
 * What needs doing, asked beside the appointment it is for, and the way on to the request.
 *
 * <p>Asked here rather than on the booking page, which is then only about who and where. The
 * booking page reads it from the address like the rest of its input, and its "Change" brings it
 * back here.
 *
 * <p>The text lives in this component's state, and that state outlasts the page's own navigations
 * — another service, another month, another time picked from the calendar — because the
 * appointment card stays in place through all of them.
 */
export function AppointmentRequest({
  slug,
  serviceId,
  serviceName,
  businessName,
  at,
  job,
  description,
  calendarHref,
}: {
  slug: string;
  serviceId: string;
  serviceName: string;
  businessName: string;
  at: string;
  /** What the customer searched for — the title of the appointment, and where the text starts. */
  job: string | null;
  /** A description brought back from the booking page, which wins over the search text. */
  description: string | null;
  /** The whole calendar, or null when it is already open. */
  calendarHref: string | null;
}) {
  const [text, setText] = useState(description ?? job ?? "");
  const [missing, setMissing] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);

  const query = new URLSearchParams({ service: serviceId, at });
  if (job) query.set("job", job);
  if (text.trim()) query.set("description", text.trim());

  return (
    <>
      <div className="mt-4">
        <Label htmlFor="job-description" className="mb-1 block text-[13px] font-semibold text-brand">
          Describe the job
        </Label>
        <Textarea
          ref={box}
          id="job-description"
          value={text}
          onChange={(e) => {
            setText(e.target.value.slice(0, DESCRIPTION_MAX));
            setMissing(false);
          }}
          rows={3}
          maxLength={DESCRIPTION_MAX}
          aria-invalid={missing}
          aria-describedby="job-description-hint"
          placeholder="No hot water since Tuesday. The boiler clicks but does not fire."
          className="bg-white"
        />
        <p
          id="job-description-hint"
          className={missing ? "m-0 mt-1 text-[12.5px] text-destructive" : "m-0 mt-1 text-[12.5px] text-faint"}
        >
          {missing
            ? "Tell them what needs doing before you request the appointment."
            : `Not the service name — ${businessName} already knows you picked ${serviceName}. This is what they read to judge whether the estimate holds.`}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {calendarHref && (
          <Link
            href={calendarHref}
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-4 py-2 text-[13.5px] font-semibold text-brand-500 no-underline transition-colors hover:border-brand-100"
          >
            <CalendarDays className="size-4" aria-hidden="true" />
            Show all availability
          </Link>
        )}
        <Link
          href={`${proPath(slug)}/book?${query}`}
          onClick={(event) => {
            // The request cannot be sent without it, so it is asked for here rather than one page on.
            if (text.trim()) return;
            event.preventDefault();
            setMissing(true);
            box.current?.focus();
          }}
          className="inline-flex items-center rounded-full bg-brand px-4 py-2 text-[13.5px] font-semibold text-white no-underline"
        >
          Request this appointment
        </Link>
      </div>
    </>
  );
}
