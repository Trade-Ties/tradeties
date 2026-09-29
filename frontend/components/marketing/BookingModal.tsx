"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowRight, Calendar, Check, ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { sendRequest } from "@/app/(marketplace)/[slug]/book/actions";
import { cn } from "@/lib/utils";
import { loadOpenings, loadServices, type PopupService } from "./booking-popup-actions";
import { opening } from "./JobSearchResults";
import type { ProCardDay, ProCardSlot, ProCardView } from "./ProCard";

// Filters keystrokes rather than only checking the result afterward — the earlier version
// relied on the native `pattern`/`maxLength` attributes reaching the underlying <input>
// through Base UI's Field.Control, which turned out not to forward them reliably outside a
// <Field.Root>. Owning validation directly, independent of that, is what actually stops
// someone from typing letters into a phone number rather than just flagging it after the fact.
const PHONE_DISALLOWED = /[^0-9+()\-\s]/g;
// 16 is what a booking request stores.
const PHONE_MAX = 16;
const PHONE_PATTERN = /^[0-9()+\-\s]{7,16}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX = 254;
const ZIP_PATTERN = /^\d{5}$/;

interface FormValues {
  name: string;
  phone: string;
  email: string;
  street: string;
  number: string;
  city: string;
  state: string;
  zip: string;
  notes: string;
}

const EMPTY_FORM: FormValues = {
  name: "",
  phone: "",
  email: "",
  street: "",
  number: "",
  city: "",
  state: "",
  zip: "",
  notes: "",
};

type FormErrors = Partial<Record<keyof FormValues, string>>;

function validate(values: FormValues): FormErrors {
  const errors: FormErrors = {};
  if (!values.name.trim()) errors.name = "Enter your name.";
  if (!PHONE_PATTERN.test(values.phone.trim())) errors.phone = "Enter a valid phone number.";
  if (!EMAIL_PATTERN.test(values.email.trim())) errors.email = "Enter a valid email address.";
  if (!values.street.trim()) errors.street = "Enter a street.";
  if (!values.number.trim()) errors.number = "Enter a house/street number.";
  if (!values.city.trim()) errors.city = "Enter a city.";
  if (!values.state.trim()) errors.state = "Enter a state.";
  if (!ZIP_PATTERN.test(values.zip.trim())) errors.zip = "Enter a 5-digit ZIP code.";
  if (!values.notes.trim()) errors.notes = "Let them know what you need done.";
  return errors;
}

/**
 * The booking dialogue behind a card's times. Opened from one of them, it starts on that time with
 * the six nearest beside it and a way into the full calendar. Opened from the card itself or its
 * "View all available times", it starts on that calendar with nothing chosen, and the fields to
 * book appear under it once a time is picked.
 *
 * For a real business (`view.booking`) it sends a real request, the same one the booking page
 * sends. A request names a service, so the dialogue asks for one when the business has several,
 * and reads that service's own open times: a start that suits a short job may not suit a long one.
 * For the sample listings it is a demo — a short delay, then a confirmation, and nothing is sent.
 */
export function BookingModal({ view, initialSlot }: { view: ProCardView; initialSlot?: ProCardSlot }) {
  const [slot, setSlot] = useState(initialSlot);
  const [showCalendar, setShowCalendar] = useState(!initialSlot);
  const chosenRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"form" | "sending" | "sent">("form");
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [contact, setContact] = useState<"" | "phone" | "email">("");
  const [failure, setFailure] = useState<string | null>(null);

  // A real business only: its services, the one chosen, and that service's open times.
  const slug = view.booking?.slug;
  const [services, setServices] = useState<PopupService[] | null>(null);
  const [serviceId, setServiceId] = useState(view.booking?.serviceId ?? "");
  const [openings, setOpenings] = useState<{ serviceId: string; slots: ProCardSlot[]; calendar: ProCardDay[] } | null>(
    null
  );

  useEffect(() => {
    if (!slug) return;
    let live = true;
    loadServices(slug).then((found) => {
      if (!live) return;
      setServices(found ?? []);
      // The search's own pick when it made one; otherwise the first service stands in until changed.
      if (found && found.length > 0) setServiceId((current) => current || found[0].id);
    });
    return () => {
      live = false;
    };
  }, [slug]);

  useEffect(() => {
    if (!slug || !serviceId) return;
    let live = true;
    loadOpenings(slug, serviceId).then((found) => {
      if (!live || !found) return;
      setOpenings({
        serviceId,
        slots: found.slots.map((at) => opening(at, found.timeZone)),
        calendar: calendarOf(found.slots, found.timeZone),
      });
    });
    return () => {
      live = false;
    };
  }, [slug, serviceId]);

  // Until a real business's times for the chosen service arrive, the card's own stand in.
  const current = slug && openings?.serviceId === serviceId ? openings : null;
  const nearSlots = current ? current.slots.slice(0, 6) : view.slots;
  const days = slug ? current?.calendar : view.calendar;

  function set<K extends keyof FormValues>(key: K, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  }

  // Checked as each field is left, not only on submit — so typing an email with no "@" (or a
  // phone that's too short) says so right away instead of staying silent until you try to send.
  // Skipped for a field that's still empty: tabbing through without typing anything isn't the
  // same mistake as typing something and leaving it half-finished, and only the second one
  // should turn red before you've even tried to submit. An empty required field is still
  // caught at submit time — this only holds off on flagging it early.
  function checkOnBlur<K extends keyof FormValues>(key: K) {
    if (!values[key].trim()) {
      setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
      return;
    }
    setErrors((prev) => ({ ...prev, [key]: validate(values)[key] }));
  }

  function choose(next: ProCardSlot) {
    // The first pick brings the fields in below the calendar; take the reader down to them.
    if (!slot) {
      requestAnimationFrame(() => chosenRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
    setSlot(next);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const nextErrors = validate(values);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    if (!slug) {
      setStatus("sending");
      window.setTimeout(() => setStatus("sent"), 700);
      return;
    }
    if (!slot || !serviceId) {
      setFailure("Choose a service and a time first.");
      return;
    }

    setFailure(null);
    setStatus("sending");
    const answer = await sendRequest({
      slug,
      serviceId,
      startsAt: slot.key,
      customerName: values.name.trim(),
      customerEmail: values.email.trim(),
      customerPhone: values.phone.trim(),
      ...(contact ? { preferredContact: contact === "phone" ? "PHONE" : "EMAIL" } : {}),
      description: values.notes.trim(),
      street1: `${values.number.trim()} ${values.street.trim()}`,
      city: values.city.trim(),
      state: values.state.trim(),
      postalCode: values.zip.trim(),
    });
    if (answer.ok) {
      setStatus("sent");
    } else {
      setStatus("form");
      setFailure(answer.message);
    }
  }

  return (
    <DialogContent className={cn(showCalendar && "sm:max-w-xl")}>
      {status === "sent" && slot ? (
        <RequestSent view={view} slot={slot} real={!!slug} />
      ) : (
        <>
          <DialogHeader>
            <DialogTitle>Book {view.title}</DialogTitle>
            <DialogDescription>{view.subtitle}</DialogDescription>
          </DialogHeader>

          {slug && services && services.length > 1 && (
            <div className="mb-5 flex flex-col gap-1.5">
              <Label htmlFor="booking-service" className="text-xs font-semibold text-muted-ink">
                Service
              </Label>
              <select
                id="booking-service"
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
                className={cn(fieldClassName, "w-full border text-foreground outline-none focus-visible:ring-2")}
              >
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {slug && services?.length === 0 && (
            <p className="mb-5 rounded-2xl border border-dashed border-line px-4 py-3.5 text-center text-sm text-muted-ink">
              {view.title} can&apos;t be booked online right now.
            </p>
          )}

          {!showCalendar && slot ? (
            <>
              <div className="mb-5 flex items-center gap-3 rounded-2xl border border-brand-100 bg-brand-50 px-4 py-3.5 text-[15px] font-semibold text-brand shadow-sm">
                <Calendar className="size-4.5 shrink-0 text-brand-500" />
                {slot.dateLabel} at {slot.timeLabel}
              </div>
              {nearSlots.length > 1 && <TimePicker slots={nearSlots} chosen={slot} onChoose={setSlot} />}
              {(slug || view.calendar) && (
                <button
                  type="button"
                  onClick={() => setShowCalendar(true)}
                  className="-mt-3 mb-6 inline-flex w-fit items-center gap-1 text-[13px] font-semibold text-brand-500 hover:underline"
                >
                  View all available times
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </button>
              )}
            </>
          ) : (
            days ? (
              <SlotCalendar key={serviceId} days={days} chosen={slot} onChoose={choose} />
            ) : (
              <p className="py-6 text-center text-sm text-muted-ink">Loading open times…</p>
            )
          )}

          {!showCalendar ? null : slot ? (
            <div
              ref={chosenRef}
              className="mt-6 mb-5 flex scroll-mt-4 items-center gap-3 rounded-2xl border border-brand-100 bg-brand-50 px-4 py-3.5 text-[15px] font-semibold text-brand shadow-sm"
            >
              <Calendar className="size-4.5 shrink-0 text-brand-500" />
              {slot.dateLabel} at {slot.timeLabel}
            </div>
          ) : (
            <p className="mt-5 rounded-2xl border border-dashed border-line px-4 py-3.5 text-center text-sm text-muted-ink">
              Pick a time above to book it.
            </p>
          )}

          {/* Kept mounted while hidden, so what was typed survives choosing another time. */}
          <form onSubmit={handleSubmit} noValidate className={cn("flex flex-col gap-4", !slot && "hidden")}>
            <TextField
              id="booking-name"
              label="Full name"
              value={values.name}
              onChange={(v) => set("name", v)}
              onBlur={() => checkOnBlur("name")}
              error={errors.name}
              placeholder="Jane Cooper"
              maxLength={80}
            />

            <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2">
              <TextField
                id="booking-phone"
                label="Phone"
                type="tel"
                inputMode="tel"
                value={values.phone}
                onChange={(v) => set("phone", v.replace(PHONE_DISALLOWED, "").slice(0, PHONE_MAX))}
                onBlur={() => checkOnBlur("phone")}
                error={errors.phone}
                placeholder="(303) 555-0182"
                maxLength={PHONE_MAX}
              />
              <TextField
                id="booking-email"
                label="Email"
                type="email"
                value={values.email}
                onChange={(v) => set("email", v.slice(0, EMAIL_MAX))}
                onBlur={() => checkOnBlur("email")}
                error={errors.email}
                placeholder="jane@email.com"
                maxLength={EMAIL_MAX}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold text-muted-ink">Service address</Label>

              <div className="grid grid-cols-[1fr_auto] gap-2">
                <AddressInput
                  aria-label="Street"
                  value={values.street}
                  onChange={(v) => set("street", v)}
                  onBlur={() => checkOnBlur("street")}
                  invalid={!!errors.street}
                  placeholder="Street"
                  maxLength={80}
                />
                <AddressInput
                  aria-label="House/street number"
                  value={values.number}
                  onChange={(v) => set("number", v)}
                  onBlur={() => checkOnBlur("number")}
                  invalid={!!errors.number}
                  placeholder="No."
                  maxLength={10}
                  className="w-20"
                />
              </div>
              {(errors.street || errors.number) && (
                <p className="text-xs text-destructive">{errors.street ?? errors.number}</p>
              )}

              <div className="grid grid-cols-[1fr_4.5rem_5.5rem] gap-2">
                <AddressInput
                  aria-label="City"
                  value={values.city}
                  onChange={(v) => set("city", v)}
                  onBlur={() => checkOnBlur("city")}
                  invalid={!!errors.city}
                  placeholder="City"
                  maxLength={60}
                />
                <AddressInput
                  aria-label="State"
                  value={values.state}
                  onChange={(v) => set("state", v.toUpperCase().slice(0, 2))}
                  onBlur={() => checkOnBlur("state")}
                  invalid={!!errors.state}
                  placeholder="State"
                  maxLength={2}
                />
                <AddressInput
                  aria-label="ZIP code"
                  value={values.zip}
                  onChange={(v) => set("zip", v.replace(/\D/g, "").slice(0, 5))}
                  onBlur={() => checkOnBlur("zip")}
                  invalid={!!errors.zip}
                  placeholder="ZIP"
                  inputMode="numeric"
                  maxLength={5}
                />
              </div>
              {(errors.city || errors.state || errors.zip) && (
                <p className="text-xs text-destructive">{errors.city ?? errors.state ?? errors.zip}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="booking-notes" className="text-xs font-semibold text-muted-ink">
                What do you need done?
              </Label>
              <Textarea
                id="booking-notes"
                rows={3}
                value={values.notes}
                onChange={(e) => set("notes", e.target.value.slice(0, 500))}
                onBlur={() => checkOnBlur("notes")}
                placeholder="Briefly describe the job..."
                maxLength={500}
                aria-invalid={!!errors.notes}
                className={cn(fieldClassName, "min-h-20", errors.notes && errorFieldClassName)}
              />
              {errors.notes && <p className="text-xs text-destructive">{errors.notes}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold text-muted-ink">Preferred contact method (optional)</Label>
              <RadioGroup
                value={contact}
                onValueChange={(value) => setContact(value as "phone" | "email")}
                className="grid-cols-2 gap-2"
              >
                <ContactOption value="phone" label="Phone" />
                <ContactOption value="email" label="Email" />
              </RadioGroup>
            </div>

            {failure && (
              <p role="alert" className="rounded-xl bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">
                {failure}
              </p>
            )}

            <Button
              type="submit"
              disabled={status === "sending"}
              className="mt-1 h-11 rounded-full text-sm font-semibold"
            >
              {status === "sending" ? "Sending request…" : "Send booking request"}
            </Button>
            <p className="text-center text-xs text-faint">
              Your request will be sent to {view.title}. Your appointment is only confirmed once they accept it.
            </p>
          </form>
        </>
      )}
    </DialogContent>
  );
}

const fieldClassName = "h-11 rounded-xl border-line bg-white px-3.5 text-sm focus-visible:ring-brand-500/30";
const errorFieldClassName = "border-destructive focus-visible:ring-destructive/30";

function TextField({
  id,
  label,
  value,
  onChange,
  error,
  ...inputProps
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
} & Omit<React.ComponentProps<typeof Input>, "id" | "value" | "onChange" | "className">) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs font-semibold text-muted-ink">
        {label}
      </Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        className={cn(fieldClassName, error && errorFieldClassName)}
        {...inputProps}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

/** A field in the address grid — no own label (the grid shares one line of error text below it). */
function AddressInput({
  value,
  onChange,
  invalid,
  className,
  ...inputProps
}: {
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
} & Omit<React.ComponentProps<typeof Input>, "value" | "onChange">) {
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-invalid={invalid}
      className={cn(fieldClassName, invalid && errorFieldClassName, className)}
      {...inputProps}
    />
  );
}

/**
 * A `Label` wrapping the radio dot plus its own text, same as the profile wizard's choice
 * tiles (components/ui/field.tsx) — not children on `RadioGroupItem` itself, which always
 * renders its own fixed dot indicator and ignores whatever children a caller passes it.
 */
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

function RequestSent({ view, slot, real }: { view: ProCardView; slot: ProCardSlot; real: boolean }) {
  return (
    <div className="flex flex-col items-center py-2 text-center">
      <div className="mb-4 grid size-14 place-items-center rounded-full bg-go-bg">
        <Check className="size-7 text-go" />
      </div>
      <h2 className="text-xl font-bold tracking-[-0.01em] text-brand">Request sent</h2>
      <p className="mt-2 max-w-[26rem] text-sm text-muted-ink">
        {view.title} will confirm your{" "}
        <span className="font-medium text-foreground">
          {slot.dateLabel} at {slot.timeLabel}
        </span>{" "}
        slot shortly — you&apos;ll hear back by phone or email.
      </p>
      {real && (
        <p className="mt-2 max-w-[26rem] text-sm text-muted-ink">
          We&apos;ve emailed you a link to follow your request and write to {view.title}.
        </p>
      )}
      <DialogClose render={<Button className="mt-6 h-10 rounded-full px-8 text-sm font-semibold" />}>
        Done
      </DialogClose>
    </div>
  );
}

/**
 * The card's own times, a row of equal chips per day under the day's name — so the eye reads down
 * the days and across the hours, rather than along one wrapped line where a day changes somewhere
 * in the middle.
 *
 * The chosen time is outlined rather than filled: the summary above already states it in bold,
 * and a solid block here would compete with it for the same attention.
 */
function TimePicker({
  slots,
  chosen,
  onChoose,
}: {
  slots: ProCardSlot[];
  chosen: ProCardSlot;
  onChoose: (slot: ProCardSlot) => void;
}) {
  // In the order given, which is soonest first; a day is a run of slots sharing a date.
  const days: { heading: string; slots: ProCardSlot[] }[] = [];
  for (const slot of slots) {
    const heading = slot.today ? "Today" : slot.dateLabel;
    const last = days[days.length - 1];
    if (last && last.heading === heading) last.slots.push(slot);
    else days.push({ heading, slots: [slot] });
  }

  // One tab stop, on the chosen time; the arrow keys move between times, as in any radio group.
  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const at = slots.findIndex((slot) => slot.key === chosen.key);
    const next = slots[(at + step + slots.length) % slots.length];
    onChoose(next);
    event.currentTarget.querySelector<HTMLButtonElement>(`[data-key="${next.key}"]`)?.focus();
  }

  return (
    <div role="radiogroup" aria-label="Choose a time" onKeyDown={onKeyDown} className="-mt-2 mb-6 flex flex-col gap-3">
      {days.map((day) => (
        <div key={day.heading}>
          <p className="m-0 mb-1.5 text-[12px] font-semibold text-muted-ink">{day.heading}</p>
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
            {day.slots.map((option) => {
              const selected = option.key === chosen.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  tabIndex={selected ? 0 : -1}
                  data-key={option.key}
                  onClick={() => onChoose(option)}
                  className={cn(
                    "rounded-xl border px-2 py-2 text-center text-[13px] tabular-nums transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    selected
                      ? "border-brand bg-brand-50 font-semibold text-brand ring-1 ring-brand"
                      : "border-line bg-white font-medium text-foreground hover:border-brand-100 hover:bg-brand-50/60"
                  )}
                >
                  {option.timeLabel}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Five days side by side, as many as fit the dialogue with a time's full width under each. */
const DAYS_PER_PAGE = 5;

/** The starts a column shows before "+ more". */
const TIMES_PER_DAY = 6;

/**
 * The listing's calendar: a page of days as columns, each with its open times stacked under it, and
 * arrows to the next days. It opens on the page holding the chosen time, or on the first one.
 *
 * The chosen time is outlined rather than filled, so it does not outweigh the summary of it that
 * appears below.
 */
function SlotCalendar({
  days,
  chosen,
  onChoose,
}: {
  days: ProCardDay[];
  chosen?: ProCardSlot;
  onChoose: (slot: ProCardSlot) => void;
}) {
  const pages = Math.max(1, Math.ceil(days.length / DAYS_PER_PAGE));
  const [page, setPage] = useState(() => {
    const at = days.findIndex((day) => day.slots.some((slot) => slot.key === chosen?.key));
    return at < 0 ? 0 : Math.floor(at / DAYS_PER_PAGE);
  });
  // A day on a half-hour grid holds sixteen starts; six a column keeps the page to a glance, and
  // "+ more" opens every column at once so the days stay level. Open from the start when the
  // chosen time is one of those that would be folded away.
  const [expanded, setExpanded] = useState(() =>
    days.some((day) => day.slots.findIndex((slot) => slot.key === chosen?.key) >= TIMES_PER_DAY)
  );
  const shown = days.slice(page * DAYS_PER_PAGE, (page + 1) * DAYS_PER_PAGE);
  if (shown.length === 0) return null;
  const folds = shown.some((day) => day.slots.length > TIMES_PER_DAY);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="m-0 text-sm font-semibold text-brand">
          {shown[0].shortDate} – {shown[shown.length - 1].shortDate}
        </p>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Earlier days"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
            className="rounded-full"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Later days"
            disabled={page === pages - 1}
            onClick={() => setPage(page + 1)}
            className="rounded-full"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
        {shown.map((day) => (
          <div key={day.key} className="flex min-w-0 flex-col gap-1.5">
            <div className="mb-1 rounded-xl bg-brand-50 py-2 text-center">
              <p className="m-0 text-[11px] font-semibold tracking-wide text-muted-ink uppercase">{day.weekday}</p>
              <p className="m-0 text-[17px] leading-tight font-bold text-brand">{day.dayOfMonth}</p>
            </div>
            {day.slots.length === 0 ? (
              <p className="m-0 py-2 text-center text-[12px] text-faint">—</p>
            ) : (
              (expanded ? day.slots : day.slots.slice(0, TIMES_PER_DAY)).map((option) => {
                const selected = option.key === chosen?.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    aria-pressed={selected}
                    aria-label={`${option.dateLabel}, ${option.timeLabel}`}
                    onClick={() => onChoose(option)}
                    className={cn(
                      "rounded-lg border px-0.5 py-1.5 text-center text-[11.5px] whitespace-nowrap tabular-nums transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:text-[13px]",
                      selected
                        ? "border-brand bg-brand-50 font-semibold text-brand ring-1 ring-brand"
                        : "border-line bg-white font-medium text-foreground hover:border-brand-100 hover:bg-brand-50/60"
                    )}
                  >
                    {option.timeLabel}
                  </button>
                );
              })
            )}
            {!expanded && day.slots.length > TIMES_PER_DAY && (
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="rounded-lg py-1.5 text-center text-[11.5px] font-semibold text-brand-500 hover:bg-brand-50 sm:text-[12.5px]"
              >
                + {day.slots.length - TIMES_PER_DAY} more
              </button>
            )}
          </div>
        ))}
      </div>

      {expanded && folds && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="mx-auto mt-3 block text-[12.5px] font-semibold text-brand-500 hover:underline"
        >
          Show fewer times
        </button>
      )}
    </div>
  );
}

/**
 * A fortnight of days from today on the business's own calendar, each with the starts that fall on
 * it — the same columns the sample listings' calendar draws, built from real instants. The days are
 * the business's, not the reader's: a start at 11 PM in Denver is on Denver's Tuesday.
 */
function calendarOf(instants: string[], timeZone: string): ProCardDay[] {
  const dayKey = (at: Date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
  const [year, month, day] = dayKey(new Date()).split("-").map(Number);

  return Array.from({ length: 15 }, (_, offset) => {
    // Noon UTC on that calendar day, printed in UTC, names the day without any zone shifting it.
    const noon = new Date(Date.UTC(year, month - 1, day + offset, 12));
    const key = noon.toISOString().slice(0, 10);
    const print = (options: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...options }).format(noon);

    return {
      key,
      weekday: offset === 0 ? "Today" : print({ weekday: "short" }),
      dayOfMonth: print({ day: "numeric" }),
      shortDate: print({ month: "short", day: "numeric" }),
      slots: instants.filter((at) => dayKey(new Date(at)) === key).map((at) => opening(at, timeZone)),
    };
  });
}
