"use client";

import { useId, useState } from "react";
import { Calendar, Check } from "lucide-react";

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
import { cn } from "@/lib/utils";
import type { ProCardSlot, ProCardView } from "./ProCard";

// Filters keystrokes rather than only checking the result afterward — the earlier version
// relied on the native `pattern`/`maxLength` attributes reaching the underlying <input>
// through Base UI's Field.Control, which turned out not to forward them reliably outside a
// <Field.Root>. Owning validation directly, independent of that, is what actually stops
// someone from typing letters into a phone number rather than just flagging it after the fact.
const PHONE_DISALLOWED = /[^0-9+()\-\s]/g;
const PHONE_MAX = 20;
const PHONE_PATTERN = /^[0-9()+\-\s]{7,20}$/;
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
 * The booking procedure, opened from a "Book <slot>" button on a pro's card.
 *
 * There is no booking endpoint anywhere in the API yet (see api/openapi.yaml
 * and app/(pro)/dashboard/demo-data.ts's header comment, which documents the
 * same gap from the pro's side) — nobody can actually reserve a slot today.
 * This simulates the round trip a real submission would make (a short delay,
 * then a confirmation) rather than pretending to save anything, and the
 * "request", not "booking", language on the confirmation matches the
 * pending/confirmed status the dashboard already uses for the same concept.
 */
export function BookingModal({ view, slot }: { view: ProCardView; slot: ProCardSlot }) {
  const [status, setStatus] = useState<"form" | "sending" | "sent">("form");
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});

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

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const nextErrors = validate(values);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setStatus("sending");
    window.setTimeout(() => setStatus("sent"), 700);
  }

  return (
    <DialogContent>
      {status === "sent" ? (
        <RequestSent view={view} slot={slot} />
      ) : (
        <>
          <DialogHeader>
            <DialogTitle>Book {view.title}</DialogTitle>
            <DialogDescription>{view.subtitle}</DialogDescription>
          </DialogHeader>

          <div className="mb-5 flex items-center gap-3 rounded-2xl border border-brand-100 bg-brand-50 px-4 py-3.5 text-[15px] font-semibold text-brand shadow-sm">
            <Calendar className="size-4.5 shrink-0 text-brand-500" />
            {slot.dateLabel} at {slot.timeLabel}
          </div>

          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
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
              <RadioGroup className="grid-cols-2 gap-2">
                <ContactOption value="phone" label="Phone" />
                <ContactOption value="email" label="Email" />
              </RadioGroup>
            </div>

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

function RequestSent({ view, slot }: { view: ProCardView; slot: ProCardSlot }) {
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
      <DialogClose render={<Button className="mt-6 h-10 rounded-full px-8 text-sm font-semibold" />}>
        Done
      </DialogClose>
    </div>
  );
}
