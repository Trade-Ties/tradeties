"use client";

import { useId, useState, useTransition } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AutocompleteControl, type AutocompleteOption } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { dayLabel, dayOf, spanLabel } from "@/components/marketing/availability";
import { money } from "@/components/marketing/business-format";
import { forgetSearch } from "@/components/marketing/search-memory";
import { sendRequest, type Sent } from "@/app/(marketplace)/[slug]/book/actions";
import { proPath } from "@/lib/routes";
import type { CreatedJob } from "@/lib/api/marketplace";

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
  startsAt,
  cancellationFee,
  cancellationNoticeHours,
  description,
  states,
}: {
  slug: string;
  businessName: string;
  serviceId: string;
  startsAt: string;
  cancellationFee: string;
  cancellationNoticeHours: number;
  /** What needs doing, as written beside the appointment on the business's page. */
  description: string;
  /** The states to pick from, or null when the list could not be read. */
  states: AutocompleteOption[] | null;
}) {
  const [pending, startSending] = useTransition();
  const [failure, setFailure] = useState<Extract<Sent, { ok: false }> | null>(null);
  const [created, setCreated] = useState<CreatedJob | null>(null);
  // Held here rather than read from the form: the dropdown keeps the code in its own state, and has
  // no field of the form's for `required` to check.
  const [state, setState] = useState("");
  const [stateMissing, setStateMissing] = useState(false);
  const [contact, setContact] = useState<"" | "PHONE" | "EMAIL">("");
  const [contactMissing, setContactMissing] = useState(false);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim();

    // Asked like every other field: the professional needs to know whether to ring or write.
    if (!contact) {
      setContactMissing(true);
      return;
    }

    if (states && !state) {
      setStateMissing(true);
      document.getElementById("state")?.focus();
      return;
    }

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
        ...(contact ? { preferredContact: contact } : {}),
        description,
        // One line on the request, written the way an address is read: "1801 Larimer St".
        street1: `${text("number")} ${text("street1")}`,
        ...(text("street2") ? { street2: text("street2") } : {}),
        city: text("city"),
        state: states ? state : text("state").toUpperCase(),
        postalCode: text("postalCode"),
      });

      if (answer.ok) {
        setCreated(answer.created);
        forgetSearch();
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

      {/*
        The fields laid out as the landing page's booking dialogue lays them out, so a request reads
        the same whichever way somebody came to it.
      */}
      <fieldset className="flex flex-col gap-4 border-0 p-0" disabled={pending}>
        <Field name="customerName" label="Full name" required maxLength={200} autoComplete="name" placeholder="Jane Cooper" />

        <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2">
          <Field
            name="customerPhone"
            label="Phone"
            type="tel"
            inputMode="tel"
            maxLength={16}
            autoComplete="tel"
            placeholder="(303) 555-0182"
          />
          <Field
            name="customerEmail"
            label="Email"
            type="email"
            required
            maxLength={320}
            autoComplete="email"
            placeholder="jane@email.com"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-xs font-semibold text-muted-ink">Service address</Label>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Input
              name="street1"
              aria-label="Street"
              required
              maxLength={180}
              autoComplete="address-line1"
              placeholder="Street"
              className={FIELD}
            />
            <Input
              name="number"
              aria-label="House/street number"
              required
              maxLength={10}
              placeholder="No."
              className={cn(FIELD, "w-20")}
            />
          </div>
          <Input
            name="street2"
            aria-label="Flat, floor, entrance"
            maxLength={200}
            autoComplete="address-line2"
            placeholder="Flat, floor, entrance (optional)"
            className={FIELD}
          />
          {/* The state column is wide enough for "Massachusetts" beside the dropdown's arrow. */}
          <div className="grid grid-cols-[1fr_9rem_5.5rem] gap-2">
            <Input
              name="city"
              aria-label="City"
              required
              maxLength={100}
              autoComplete="address-level2"
              placeholder="City"
              className={FIELD}
            />
            {states ? (
              <AutocompleteControl
                id="state"
                aria-label="State"
                options={states}
                value={state}
                onValueChange={(code) => {
                  setState(code);
                  setStateMissing(false);
                }}
                placeholder="State"
                aria-required
                aria-invalid={stateMissing}
                className={cn(FIELD, stateMissing && "border-destructive")}
              />
            ) : (
              <Input
                id="state"
                name="state"
                aria-label="State"
                required
                maxLength={2}
                pattern="[A-Za-z]{2}"
                placeholder="State"
                autoComplete="address-level1"
                className={FIELD}
              />
            )}
            <Input
              name="postalCode"
              aria-label="ZIP code"
              required
              maxLength={10}
              inputMode="numeric"
              autoComplete="postal-code"
              pattern="\d{5}(-\d{4})?"
              placeholder="ZIP"
              className={FIELD}
            />
          </div>
          {stateMissing && <p className="m-0 text-xs text-destructive">Choose a state.</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-semibold text-muted-ink">Preferred contact method</Label>
          <RadioGroup
            value={contact}
            onValueChange={(value) => {
              setContact(value as "PHONE" | "EMAIL");
              setContactMissing(false);
            }}
            aria-invalid={contactMissing}
            className="grid-cols-2 gap-2"
          >
            <ContactOption value="PHONE" label="Phone" />
            <ContactOption value="EMAIL" label="Email" />
          </RadioGroup>
          {contactMissing && <p className="m-0 text-xs text-destructive">Choose how they should reach you.</p>}
        </div>
      </fieldset>

      {failure && <Failure failure={failure} slug={slug} serviceId={serviceId} />}

      <Button type="submit" disabled={pending} className="h-11 w-full rounded-full text-sm font-semibold">
        {pending ? "Sending request…" : "Send booking request"}
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
        professional decides, and the same time stays on offer to everybody else until they do.
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
              href={`${proPath(slug)}?service=${serviceId}&calendar=1#when`}
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

/** The booking dialogue's field: white, roomy, rounded, with the example inside it. */
const FIELD = "h-11 rounded-xl border-line bg-white px-3.5 text-sm focus-visible:ring-brand-500/30";

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
  ...input
}: {
  name: string;
  label: string;
} & React.ComponentProps<typeof Input>) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name} className="text-xs font-semibold text-muted-ink">
        {label}
      </Label>
      <Input id={name} name={name} className={FIELD} {...input} />
    </div>
  );
}

/** A radio dot and its word inside one tile, as in the booking dialogue. */
function ContactOption({ value, label }: { value: string; label: string }) {
  const id = useId();

  return (
    <Label
      htmlFor={id}
      className="flex cursor-pointer items-center justify-start gap-2 rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm font-medium text-muted-ink transition-colors hover:border-brand-100 has-data-checked:border-brand has-data-checked:bg-brand-50 has-data-checked:text-brand-500"
    >
      <RadioGroupItem value={value} id={id} />
      {label}
    </Label>
  );
}
