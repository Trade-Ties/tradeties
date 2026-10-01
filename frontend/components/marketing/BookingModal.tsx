"use client";

import { useEffect, useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ArrowRight, Calendar, Check, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DIALOG_WIDE,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AutocompleteControl, type AutocompleteOption } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { sendRequest } from "@/app/(marketplace)/[slug]/book/actions";
import { cn } from "@/lib/utils";
import { DIALOG_CALENDAR_WEEKS } from "./availability";
import { loadOpenings, loadServices, loadStates, type PopupService } from "./booking-popup-actions";
import { opening } from "./JobSearchResults";
import type { ProCardDay, ProCardSlot, ProCardView } from "./ProCard";
import { forgetSearch } from "./search-memory";

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
  /** Flat, floor, entrance — the one address line nobody has to fill in. */
  street2: string;
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
  street2: "",
  city: "",
  state: "",
  zip: "",
  notes: "",
};

type FormErrors = Partial<Record<keyof FormValues, string>>;

/**
 * The states, read once per page rather than once per dialogue — the list is the same for every
 * business. A failed read is not remembered, so the next dialogue asks again.
 */
let statesOnce: Promise<AutocompleteOption[] | null> | null = null;

function statesList(): Promise<AutocompleteOption[] | null> {
  statesOnce ??= loadStates().then((found) => {
    if (!found) statesOnce = null;
    return found;
  });
  return statesOnce;
}

function validate(values: FormValues): FormErrors {
  const errors: FormErrors = {};
  if (!values.name.trim()) errors.name = "Enter your name.";
  if (!PHONE_PATTERN.test(values.phone.trim())) errors.phone = "Enter a valid phone number.";
  if (!EMAIL_PATTERN.test(values.email.trim())) errors.email = "Enter a valid email address.";
  if (!values.street.trim()) errors.street = "Enter a street.";
  if (!values.number.trim()) errors.number = "Enter a house/street number.";
  if (!values.city.trim()) errors.city = "Enter a city.";
  if (!values.state.trim()) errors.state = "Choose a state.";
  if (!ZIP_PATTERN.test(values.zip.trim())) errors.zip = "Enter a 5-digit ZIP code.";
  if (!values.notes.trim()) errors.notes = "Let them know what you need done.";
  return errors;
}

/**
 * The booking dialogue behind a card's times. Opened from one of them, it starts on that time with
 * the six nearest beside it and a way into the full calendar. Opened from the card itself or its
 * "View all available times", it starts on that calendar with nothing chosen. Picking a time folds
 * the calendar away behind the time it chose, and the fields to book appear under that.
 *
 * For a real business (`view.booking`) it sends a real request, the same one the booking page
 * sends. A request names a service, so the dialogue asks for one when the business has several,
 * and reads that service's own open times: a start that suits a short job may not suit a long one.
 * For the sample listings it is a demo — a short delay, then a confirmation, and nothing is sent.
 */
export function BookingModal({ view, initialSlot }: { view: ProCardView; initialSlot?: ProCardSlot }) {
  const [slot, setSlot] = useState(initialSlot);
  // "near": the card's own times around the one it was opened on. "folded": the calendar closed
  // behind the time picked from it.
  const [picker, setPicker] = useState<"near" | "calendar" | "folded">(initialSlot ? "near" : "calendar");
  const toggleRef = useRef<HTMLButtonElement>(null);
  const [status, setStatus] = useState<"form" | "sending" | "sent">("form");
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [contact, setContact] = useState<"" | "phone" | "email">("");
  const [contactMissing, setContactMissing] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Undefined while the list is being read, null if it could not be.
  const [states, setStates] = useState<AutocompleteOption[] | null | undefined>(undefined);

  useEffect(() => {
    let live = true;
    statesList().then((found) => {
      if (live) setStates(found);
    });
    return () => {
      live = false;
    };
  }, []);

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
    // The time that was clicked goes away with the calendar, and focus with it. Handed on before
    // this click is over: the dialogue sends focus it finds lost back to its own top, and it
    // looks after this handler has run.
    flushSync(() => {
      setSlot(next);
      setPicker("folded");
    });
    toggleRef.current?.focus();
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const nextErrors = validate(values);
    // Asked like every other field: the professional needs to know whether to ring or write.
    setContactMissing(!contact);
    if (Object.keys(nextErrors).length > 0 || !contact) {
      setErrors(nextErrors);
      // The description sits at the top, a scroll away from this button; a mistake there would
      // otherwise go unseen.
      requestAnimationFrame(() =>
        contentRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
      );
      return;
    }
    if (!slug) {
      setStatus("sending");
      window.setTimeout(() => {
        setStatus("sent");
        forgetSearch();
      }, 700);
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
      // Absent rather than empty, as the booking page sends it.
      ...(values.street2.trim() ? { street2: values.street2.trim() } : {}),
      city: values.city.trim(),
      state: values.state.trim(),
      postalCode: values.zip.trim(),
    });
    if (answer.ok) {
      setStatus("sent");
      forgetSearch();
    } else {
      setStatus("form");
      setFailure(answer.message);
    }
  }

  return (
    // Half the screen once that is wide enough for a week of times, and the same width in every step,
    // so folding the calendar away does not make the dialogue jump.
    <DialogContent
      ref={contentRef}
      // The first field is the description, and focusing it on a touch screen would raise the
      // keyboard over the calendar before anybody asked to type. There the dialogue itself takes
      // focus; with a mouse, the description does, ready to type into.
      initialFocus={() => (window.matchMedia("(pointer: coarse)").matches ? contentRef.current : true)}
      className={DIALOG_WIDE}
    >
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
          {slug && services?.length === 0 ? (
            <p className="mb-5 rounded-2xl border border-dashed border-line px-4 py-3.5 text-center text-sm text-muted-ink">
              {view.title} can&apos;t be booked online right now.
            </p>
          ) : (
            // Beside the service, since both say what the job is, and outside the form below: the
            // submit reads `values`, not the form's fields, so where this sits changes nothing it sends.
            <div className="mb-5 flex flex-col gap-1.5">
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
          )}

          {picker === "near" && slot ? (
            <>
              <ChosenTime slot={slot} />
              {nearSlots.length > 1 && <TimePicker slots={nearSlots} chosen={slot} onChoose={setSlot} />}
              {(slug || view.calendar) && (
                <button
                  type="button"
                  onClick={() => setPicker("calendar")}
                  className="-mt-3 mb-6 inline-flex w-fit items-center gap-1 text-[13px] font-semibold text-brand-500 hover:underline"
                >
                  View all available times
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </button>
              )}
            </>
          ) : (
            <>
              {slot && (
                <ChosenTime slot={slot}>
                  <button
                    ref={toggleRef}
                    type="button"
                    aria-expanded={picker === "calendar"}
                    onClick={() => setPicker(picker === "calendar" ? "folded" : "calendar")}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md text-[13px] font-semibold text-brand-500 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {picker === "calendar" ? "Close" : "Change time"}
                    <ChevronDown
                      className={cn("size-4 transition-transform", picker === "calendar" && "rotate-180")}
                      aria-hidden="true"
                    />
                  </button>
                </ChosenTime>
              )}

              {picker === "calendar" &&
                (days ? (
                  <SlotCalendar key={serviceId} days={days} chosen={slot} onChoose={choose} />
                ) : (
                  <p className="py-6 text-center text-sm text-muted-ink">Loading open times…</p>
                ))}

              {!slot && (
                <p className="mt-5 rounded-2xl border border-dashed border-line px-4 py-3.5 text-center text-sm text-muted-ink">
                  Pick a time above to book it.
                </p>
              )}
            </>
          )}

          {/* Kept mounted while hidden, so what was typed survives choosing another time. */}
          <form
            onSubmit={handleSubmit}
            noValidate
            className={cn("flex flex-col gap-4", (!slot || picker === "calendar") && "hidden")}
          >
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
                  // Short of the full width on a phone, where it would leave the street no wider.
                  className="w-28 sm:w-40"
                />
              </div>
              {(errors.street || errors.number) && (
                <p className="text-xs text-destructive">{errors.street ?? errors.number}</p>
              )}

              <AddressInput
                aria-label="Flat, floor, entrance"
                value={values.street2}
                onChange={(v) => set("street2", v)}
                placeholder="Flat, floor, entrance (optional)"
                autoComplete="address-line2"
                maxLength={200}
              />

              {/* On a phone the city takes a line of its own; State and ZIP at these widths leave it none. */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_9rem_11rem]">
                <AddressInput
                  aria-label="City"
                  value={values.city}
                  onChange={(v) => set("city", v)}
                  onBlur={() => checkOnBlur("city")}
                  invalid={!!errors.city}
                  placeholder="City"
                  maxLength={60}
                  className="col-span-2 sm:col-span-1"
                />
                {states ? (
                  <AutocompleteControl
                    aria-label="State"
                    options={states}
                    value={values.state}
                    onValueChange={(code) => set("state", code)}
                    placeholder="State"
                    aria-invalid={!!errors.state}
                    className={cn(fieldClassName, errors.state && errorFieldClassName)}
                  />
                ) : (
                  // Until the list arrives, or if it cannot be read: the two letters, typed.
                  <AddressInput
                    aria-label="State"
                    value={values.state}
                    onChange={(v) => set("state", v.toUpperCase().slice(0, 2))}
                    onBlur={() => checkOnBlur("state")}
                    invalid={!!errors.state}
                    placeholder="State"
                    maxLength={2}
                  />
                )}
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
              <Label className="text-xs font-semibold text-muted-ink">Preferred contact method</Label>
              <RadioGroup
                value={contact}
                onValueChange={(value) => {
                  setContact(value as "phone" | "email");
                  setContactMissing(false);
                }}
                aria-invalid={contactMissing}
                className="grid-cols-2 gap-2"
              >
                <ContactOption value="phone" label="Phone" />
                <ContactOption value="email" label="Email" />
              </RadioGroup>
              {contactMissing && <p className="text-xs text-destructive">Choose how they should reach you.</p>}
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

/** The time picked, and — once it came from the calendar — the way back into it. */
function ChosenTime({ slot, children }: { slot: ProCardSlot; children?: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-center gap-3 rounded-2xl border border-brand-100 bg-brand-50 px-4 py-3.5 text-[15px] font-semibold text-brand shadow-sm">
      <Calendar className="size-4.5 shrink-0 text-brand-500" />
      <span className="min-w-0 flex-1">
        {slot.dateLabel} at {slot.timeLabel}
      </span>
      {children}
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

/** A week a page, Sunday first. Both calendars behind it start on a Sunday. */
const DAYS_PER_PAGE = 7;

/**
 * The listing's calendar: a week of days as columns, each with every open time stacked under it,
 * and arrows to the next weeks. It opens on the week holding the chosen time, or else on the first
 * with a time left in it — late in a week, today's may have none.
 *
 * A busy day makes the dialogue longer rather than scrolling inside it: one scroll, the
 * dialogue's own.
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
    const chosenAt = days.findIndex((day) => day.slots.some((slot) => slot.key === chosen?.key));
    const at = chosenAt >= 0 ? chosenAt : days.findIndex((day) => day.slots.length > 0);
    return at < 0 ? 0 : Math.floor(at / DAYS_PER_PAGE);
  });
  const shown = days.slice(page * DAYS_PER_PAGE, (page + 1) * DAYS_PER_PAGE);
  if (shown.length === 0) return null;

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

      {/* On a phone a time takes two lines, "10:30" over "AM", since seven columns leave no width for one. */}
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {shown.map((day) => (
          <div key={day.key} className="flex min-w-0 flex-col gap-1.5">
            <div
              className={cn(
                "flex h-13 flex-col items-center justify-center rounded-xl",
                day.past ? "bg-[#EEF1F5]" : "bg-brand-50"
              )}
            >
              <p
                className={cn(
                  "m-0 text-[10px] font-semibold tracking-wide uppercase sm:text-[11px]",
                  day.past ? "text-faint" : "text-muted-ink"
                )}
              >
                {day.weekday}
              </p>
              <p className={cn("m-0 text-[17px] leading-tight font-bold", day.past ? "text-faint" : "text-brand")}>
                {day.dayOfMonth}
              </p>
            </div>
            {day.slots.length === 0 ? (
              <p className="m-0 py-2 text-center text-[12px] text-faint">—</p>
            ) : (
              day.slots.map((option) => {
                const selected = option.key === chosen?.key;
                const [time, meridiem] = option.timeLabel.split(/\s+/);
                return (
                  <button
                    key={option.key}
                    type="button"
                    aria-pressed={selected}
                    aria-label={`${option.dateLabel}, ${option.timeLabel}`}
                    onClick={() => onChoose(option)}
                    className={cn(
                      "flex h-9 shrink-0 items-center justify-center rounded-lg border px-0.5 text-[11.5px] whitespace-nowrap tabular-nums transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none max-sm:flex-col max-sm:leading-none sm:h-8 sm:gap-[0.3em] sm:text-[13px]",
                      selected
                        ? "border-brand bg-brand-50 font-semibold text-brand ring-1 ring-brand"
                        : "border-line bg-white font-medium text-foreground hover:border-brand-100 hover:bg-brand-50/60"
                    )}
                  >
                    <span>{time}</span>
                    {meridiem && <span className="max-sm:mt-0.5 max-sm:text-[9.5px]">{meridiem}</span>}
                  </button>
                );
              })
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Whole weeks from this week's Sunday on the business's own calendar, each day with the starts that
 * fall on it — the same columns the sample listings' calendar draws, built from real instants. The
 * days are the business's, not the reader's: a start at 11 PM in Denver is on Denver's Tuesday.
 */
function calendarOf(instants: string[], timeZone: string): ProCardDay[] {
  const dayKey = (at: Date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
  const [year, month, day] = dayKey(new Date()).split("-").map(Number);
  const todayInWeek = new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();

  return Array.from({ length: DIALOG_CALENDAR_WEEKS * 7 }, (_, index) => {
    const offset = index - todayInWeek;
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
      past: offset < 0,
      slots: instants.filter((at) => dayKey(new Date(at)) === key).map((at) => opening(at, timeZone)),
    };
  });
}
