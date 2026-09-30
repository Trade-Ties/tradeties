"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { dayLabel, dayOf, spanLabel } from "@/components/marketing/availability";
import { money } from "@/components/marketing/business-format";
import { sendRequest, type Sent } from "@/app/(marketplace)/[slug]/book/actions";
import { proPath } from "@/lib/routes";
import type { CreatedJob } from "@/lib/api/marketplace";

const STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID", "IL", "IN", "IA",
  "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM",
  "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA",
  "WV", "WI", "WY",
];

/**
 * The nine fields, and what comes back when they are sent.
 *
 * <p><strong>The confirmation replaces the form in place rather than being a page of its own.</strong>
 * What comes back includes an access token, and a token in an address is a credential in the
 * browser history, in the referrer of the next request and in anything that logs URLs. Shown
 * here, it exists only on the screen of the person who sent the form.
 *
 * <p>The cost is real and is stated to the customer rather than hidden: reloading loses it. That
 * is what "issued once" means, and it is why the token is offered as a link to keep.
 */
export function BookingForm({
  slug,
  businessName,
  serviceId,
  serviceName,
  startsAt,
  cancellationFee,
  cancellationNoticeHours,
  description,
}: {
  slug: string;
  businessName: string;
  serviceId: string;
  serviceName: string;
  startsAt: string;
  cancellationFee: string;
  cancellationNoticeHours: number;
  /** What the customer searched for, to start the description from; empty when there was none. */
  description?: string;
}) {
  const [pending, startSending] = useTransition();
  const [failure, setFailure] = useState<Extract<Sent, { ok: false }> | null>(null);
  const [created, setCreated] = useState<CreatedJob | null>(null);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim();

    setFailure(null);

    startSending(async () => {
      const answer = await sendRequest({
        slug,
        serviceId,
        startsAt,
        customerName: text("customerName"),
        customerEmail: text("customerEmail"),
        // Absent rather than empty: the column means "no number given", and a blank string would
        // read as one that happens to have no digits.
        ...(text("customerPhone") ? { customerPhone: text("customerPhone") } : {}),
        description: text("description"),
        street1: text("street1"),
        ...(text("street2") ? { street2: text("street2") } : {}),
        city: text("city"),
        state: text("state"),
        postalCode: text("postalCode"),
      });

      if (answer.ok) {
        setCreated(answer.created);
      } else {
        setFailure(answer);
      }
    });
  };

  if (created) {
    return <Confirmation created={created} businessName={businessName} />;
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <Terms fee={cancellationFee} noticeHours={cancellationNoticeHours} />

      <fieldset className="flex flex-col gap-4 border-0 p-0" disabled={pending}>
        <Group title="How can they reach you?">
          <Field name="customerName" label="Your name" required maxLength={200} autoComplete="name" />
          <Field
            name="customerEmail"
            label="Email"
            type="email"
            required
            maxLength={320}
            autoComplete="email"
            hint="Where the answer goes, and your only way back to this request."
          />
          <Field
            name="customerPhone"
            label="Phone"
            maxLength={16}
            autoComplete="tel"
            hint="Optional. Some jobs are settled faster by phone."
          />
        </Group>

        <Group title="What needs doing?">
          <div>
            <Label htmlFor="description" className="mb-1 block text-[13px] font-semibold text-brand">
              Describe the job
            </Label>
            <Textarea
              id="description"
              name="description"
              required
              maxLength={2000}
              rows={4}
              defaultValue={description}
              placeholder="No hot water since Tuesday. The boiler clicks but does not fire."
            />
            <p className="m-0 mt-1 text-[12.5px] text-faint">
              Not the service name — {businessName} already knows you picked {serviceName}. This is
              what they read to judge whether the estimate holds.
            </p>
          </div>
        </Group>

        <Group title="Where is the job?">
          <Field name="street1" label="Street address" required maxLength={200} autoComplete="address-line1" />
          <Field
            name="street2"
            label="Flat, floor, entrance"
            maxLength={200}
            autoComplete="address-line2"
            hint="Optional."
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_120px_140px]">
            <Field name="city" label="City" required maxLength={100} autoComplete="address-level2" />
            <div>
              <Label htmlFor="state" className="mb-1 block text-[13px] font-semibold text-brand">
                State
              </Label>
              <select
                id="state"
                name="state"
                required
                defaultValue=""
                className="h-9 w-full rounded-lg border border-line bg-white px-2.5 text-[14px] text-brand"
              >
                <option value="" disabled>
                  —
                </option>
                {STATES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </div>
            <Field
              name="postalCode"
              label="ZIP code"
              required
              maxLength={10}
              inputMode="numeric"
              autoComplete="postal-code"
              pattern="\d{5}(-\d{4})?"
            />
          </div>
        </Group>
      </fieldset>

      {failure && <Failure failure={failure} slug={slug} serviceId={serviceId} />}

      <Button
        type="submit"
        disabled={pending}
        className="h-auto w-full rounded-2xl py-3.5 text-[15px] font-semibold"
      >
        {pending ? "Sending…" : "Send this request"}
      </Button>
    </form>
  );
}

/**
 * The pair a customer has to have read before sending, and the reason it is above the fields
 * rather than in small print beneath the button: the fee is frozen onto the request as it is
 * sent, so what is shown here is what binds.
 */
function Terms({ fee, noticeHours }: { fee: string; noticeHours: number }) {
  const free = Number(fee) === 0;

  return (
    <div className="rounded-2xl border border-line bg-canvas px-5 py-4 text-[13.5px] leading-relaxed text-muted-ink">
      <p className="m-0">
        <span className="font-semibold text-brand">Nothing is booked by sending this.</span> The
        tradesperson decides, and the same time stays on offer to everybody else until they do.
      </p>
      <p className="m-0 mt-2">
        {free
          ? "Cancelling is free."
          : `If you cancel within ${noticeHours} hours of the appointment, they charge ${money(fee)}.`}{" "}
        These are their terms as shown today, and they are recorded with your request.
      </p>
    </div>
  );
}

function Confirmation({ created, businessName }: { created: CreatedJob; businessName: string }) {
  const { request, accessToken } = created;
  const keepLink = `${proPath(request.businessSlug)}/requests/${accessToken}`;

  return (
    <div className="rounded-3xl border border-line bg-white p-6">
      <p className="m-0 flex items-center gap-2 text-[17px] font-bold tracking-[-0.02em] text-brand">
        <CheckCircle2 className="size-5 text-go" aria-hidden="true" />
        Your request is with {businessName}.
      </p>

      <dl className="mt-5 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
        <Row label="Job" value={request.serviceName} />
        <Row
          label="When"
          value={`${dayLabel(dayOf(request.startsAt, request.timeZone))}, ${spanLabel(
            request.startsAt,
            request.estimatedDurationMinutes,
            request.timeZone,
          )}`}
        />
        <Row label="Times shown in" value={request.timeZone} />
        <Row
          label="If you cancel"
          value={
            Number(request.cancellationFee) === 0
              ? "Free"
              : `${money(request.cancellationFee)} within ${request.cancellationNoticeHours} hours`
          }
        />
      </dl>

      <div className="mt-6 rounded-2xl border border-brand-100 bg-brand-50 px-5 py-4">
        <p className="m-0 text-[13.5px] font-semibold text-brand">Keep this link.</p>
        <p className="m-0 mt-1 text-[13px] leading-relaxed text-muted-ink">
          You have no account with TradeTies, so this link is your way back to this request. We have
          emailed it to you as well — reloading this page will not bring it back.
        </p>
        <code className="mt-2.5 block overflow-x-auto rounded-xl border border-line bg-white px-3 py-2 text-[12.5px] text-brand">
          {keepLink}
        </code>
      </div>

      <p className="m-0 mt-5 text-[13px] leading-relaxed text-muted-ink">
        {businessName} has not seen it yet either: their inbox is the next thing we are building,
        and nobody can accept or decline until it lands.
      </p>
    </div>
  );
}

function Failure({
  failure,
  slug,
  serviceId,
}: {
  failure: Extract<Sent, { ok: false }>;
  slug: string;
  serviceId: string;
}) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-2xl border border-stop/30 bg-stop-bg px-5 py-4 text-[13.5px] leading-relaxed text-brand"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0 text-stop" aria-hidden="true" />
      <div>
        <p className="m-0">{failure.message}</p>
        <p className="m-0 mt-1 text-muted-ink">
          Nothing was sent.{" "}
          {failure.stale && (
            <Link
              href={`${proPath(slug)}?service=${serviceId}`}
              className="font-semibold text-brand-500 hover:underline"
            >
              Pick another time
            </Link>
          )}
        </p>
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="m-0 text-[12px] font-bold uppercase tracking-[0.04em] text-faint">{title}</h2>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-line pb-3">
      <dt className="text-[11.5px] font-bold uppercase tracking-[0.04em] text-faint">{label}</dt>
      <dd className="m-0 mt-0.5 text-[14px] text-brand">{value}</dd>
    </div>
  );
}

function Field({
  name,
  label,
  hint,
  ...input
}: {
  name: string;
  label: string;
  hint?: string;
} & React.ComponentProps<typeof Input>) {
  return (
    <div>
      <Label htmlFor={name} className="mb-1 block text-[13px] font-semibold text-brand">
        {label}
      </Label>
      <Input id={name} name={name} {...input} />
      {hint && <p className="m-0 mt-1 text-[12.5px] text-faint">{hint}</p>}
    </div>
  );
}
