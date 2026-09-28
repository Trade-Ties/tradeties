"use client";

import { useId, useState } from "react";
import { differenceInMinutes, format, parse } from "date-fns";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckboxField } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import type { BookingPrefill, NewBooking } from "./booking";
import { appointmentStart } from "./calendarFile";
import type { CalendarEntry, DemoAppointment, KnownCustomer, TimeOff } from "./demo-data";

/**
 * What is being put in the calendar: a job for a customer the tradesperson booked themselves —
 * somebody who phoned, a regular — a few hours of their own that nobody can book, or whole days
 * away.
 */
export type EntryKind = "appointment" | "blocked" | "timeOff";

interface Draft {
  kind: EntryKind;
  /** `yyyy-MM-dd` and `HH:mm`: what the browser's own date and time pickers read and write. */
  date: string;
  start: string;
  end: string;
  notes: string;
  // Blocked time
  title: string;
  // Time off: whole days, both ends included
  fromDate: string;
  toDate: string;
  // Appointment
  customerName: string;
  service: string;
  phone: string;
  email: string;
  street: string;
  number: string;
  city: string;
  state: string;
  zip: string;
  notify: boolean;
  replaces: boolean;
}

/** The customer's details as the form's fields hold them. */
const customerFields = (c: KnownCustomer) => ({
  customerName: c.name,
  phone: c.phone,
  email: c.email,
  street: c.address.street,
  number: c.address.number,
  city: c.address.city,
  state: c.address.state,
  zip: c.address.zip,
});

const draftFor = (day: Date, kind: EntryKind, prefill?: BookingPrefill): Draft => ({
  kind,
  date: format(day, "yyyy-MM-dd"),
  fromDate: format(day, "yyyy-MM-dd"),
  toDate: format(day, "yyyy-MM-dd"),
  start: "09:00",
  end: "10:00",
  notes: prefill?.notes ?? "",
  title: "",
  customerName: "",
  service: prefill?.service ?? "",
  phone: "",
  email: "",
  street: "",
  number: "",
  city: "",
  state: "",
  zip: "",
  ...(prefill ? customerFields(prefill.customer) : {}),
  notify: true,
  replaces: prefill?.replaces !== undefined,
});

const at = (date: string, time: string) => parse(`${date} ${time}`, "yyyy-MM-dd HH:mm", new Date());
const dayOf = (date: string) => parse(date, "yyyy-MM-dd", new Date());

type Problems = Partial<Record<"title" | "customerName" | "service" | "time" | "email" | "zip", string>>;

function problemsIn(d: Draft): Problems {
  const problems: Problems = {};

  if (d.kind === "timeOff") {
    if (d.fromDate === "" || d.toDate === "") problems.time = "Pick the first and the last day.";
    else if (dayOf(d.toDate) < dayOf(d.fromDate)) problems.time = "The last day can't be before the first.";
    return problems;
  }

  if (d.date === "" || d.start === "" || d.end === "") problems.time = "Pick a day and a time.";
  else if (at(d.date, d.end) <= at(d.date, d.start)) problems.time = "The end has to be after the start.";

  if (d.kind === "blocked") {
    if (d.title.trim() === "") problems.title = "Give it a name.";
    return problems;
  }

  if (d.customerName.trim() === "") problems.customerName = "Who is it for?";
  if (d.service.trim() === "") problems.service = "What's the job?";
  if (d.email.trim() !== "" && !/^\S+@\S+\.\S+$/.test(d.email.trim()))
    problems.email = "That doesn't look like an email.";
  else if (d.notify && d.email.trim() === "")
    problems.email = "Add their email to send the confirmation — or untick sending it below.";
  if (d.zip.trim() !== "" && !/^\d{5}$/.test(d.zip.trim())) problems.zip = "5 digits.";

  return problems;
}

/**
 * The form behind "New entry": an appointment the tradesperson books for a customer, or a block
 * of their own time — on the day the calendar has picked unless they change it.
 *
 * The draft is read from `day` once, when the form mounts, so the caller keys it afresh on each
 * opening — otherwise it would reopen on the last day and the last half-typed name.
 */
export function NewEntryDialog({
  open,
  onOpenChange,
  day,
  customers = [],
  appointments = [],
  prefill,
  initialKind = "appointment",
  onAddEntry,
  onAddAppointment,
  onAddTimeOff,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  day: Date;
  /** Offered as the customer's name is typed; picking one fills in the rest. */
  customers?: KnownCustomer[];
  /** Set when booking for somebody in particular — from their request or their conversation. */
  prefill?: BookingPrefill;
  /** Read for time off, to say which booked jobs fall inside the days away. */
  appointments?: DemoAppointment[];
  /** What the form opens on — "Add time off" elsewhere in the portal opens it on time off. */
  initialKind?: EntryKind;
  onAddEntry: (entry: Omit<CalendarEntry, "id">) => void;
  onAddAppointment: (booking: NewBooking) => void;
  /** Left out where time off cannot be kept, and the option is not offered. */
  onAddTimeOff?: (timeOff: Omit<TimeOff, "id">) => void;
}) {
  const [draft, setDraft] = useState<Draft>(() =>
    draftFor(prefill?.replaces?.date ?? day, prefill ? "appointment" : initialKind, prefill)
  );
  const [tried, setTried] = useState(false);
  const id = useId();

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const problems = problemsIn(draft);
  const shown = (key: keyof Problems) => (tried ? problems[key] : undefined);

  const submit = () => {
    setTried(true);
    if (Object.keys(problems).length > 0) return;

    const start = at(draft.date, draft.start);
    const end = at(draft.date, draft.end);

    if (draft.kind === "timeOff") {
      onAddTimeOff?.({ from: dayOf(draft.fromDate), to: dayOf(draft.toDate), note: draft.notes.trim() || undefined });
    } else if (draft.kind === "blocked") {
      onAddEntry({ title: draft.title.trim(), start, end, notes: draft.notes.trim() || undefined });
    } else {
      onAddAppointment({
        notify: draft.notify,
        replacesId: prefill?.replaces && draft.replaces ? prefill.replaces.id : undefined,
        appointment: {
          customerName: draft.customerName.trim(),
          service: draft.service.trim(),
          phone: draft.phone.trim(),
          email: draft.email.trim(),
          address: {
            street: draft.street.trim(),
            number: draft.number.trim(),
            city: draft.city.trim(),
            state: draft.state.trim().toUpperCase(),
            zip: draft.zip.trim(),
          },
          notes: draft.notes.trim(),
          date: new Date(new Date(start).setHours(0, 0, 0, 0)),
          time: format(start, "h:mm a"),
          durationMinutes: differenceInMinutes(end, start),
          // Booked by the tradesperson, so there is nobody left to confirm it.
          status: "confirmed",
          bookedBy: "pro",
        },
      });
    }
    onOpenChange(false);
  };

  const appointment = draft.kind === "appointment";
  const timeOff = draft.kind === "timeOff";

  // Booked jobs inside the days away: they stay booked — the tradesperson moves or cancels them
  // with the customer — but saving without saying so would leave a job nobody is coming to.
  const clashes =
    timeOff && !problems.time
      ? appointments.filter((a) => {
          const t = a.date.getTime();
          return t >= dayOf(draft.fromDate).getTime() && t <= dayOf(draft.toDate).getTime();
        })
      : [];
  const firstName = draft.customerName.trim().split(" ")[0] || "the customer";
  const listId = `${id}-customers`;

  /** A name the list knows fills in whatever of the rest is still empty — never over what was typed. */
  const pickCustomer = (name: string) => {
    const known = customers.find((c) => c.name === name);
    if (!known) return set({ customerName: name });

    const fields = customerFields(known);
    setDraft((d) => ({
      ...d,
      ...Object.fromEntries(
        Object.entries(fields).filter(([key]) => key === "customerName" || d[key as keyof Draft] === "")
      ),
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="flex flex-col gap-5"
        >
          <DialogHeader>
            <DialogTitle>{prefill ? `Book ${prefill.customer.name}` : "New calendar entry"}</DialogTitle>
            <DialogDescription>
              {appointment
                ? "Book a job for a customer yourself — agreed on the phone, or for a regular. It goes straight in as confirmed."
                : timeOff
                  ? "Days you're away — a vacation, a trade show. Customers can't book you on any of them."
                  : "A few hours for yourself — a supplier run, a job booked elsewhere. Customers can't book you during it."}
            </DialogDescription>
          </DialogHeader>

          {/* Booking for somebody in particular is always an appointment. */}
          {!prefill && (
            <div role="radiogroup" aria-label="Kind of entry" className="flex gap-1 rounded-full bg-brand-50 p-1">
              <KindOption active={appointment} onClick={() => set({ kind: "appointment" })}>
                Appointment
              </KindOption>
              <KindOption active={draft.kind === "blocked"} onClick={() => set({ kind: "blocked" })}>
                Blocked time
              </KindOption>
              {onAddTimeOff && (
                <KindOption active={timeOff} onClick={() => set({ kind: "timeOff" })}>
                  Time off
                </KindOption>
              )}
            </div>
          )}

          {appointment ? (
            <>
              <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
                <FormField id={`${id}-customer`} label="Customer" problem={shown("customerName")}>
                  <Input
                    id={`${id}-customer`}
                    value={draft.customerName}
                    onChange={(e) => pickCustomer(e.target.value)}
                    placeholder="Jane Cooper"
                    maxLength={120}
                    autoComplete="off"
                    list={customers.length > 0 ? listId : undefined}
                    aria-invalid={shown("customerName") ? true : undefined}
                    className="h-10"
                  />
                  <datalist id={listId}>
                    {customers.map((c) => (
                      <option key={c.name} value={c.name} />
                    ))}
                  </datalist>
                </FormField>
                <FormField id={`${id}-service`} label="Job" problem={shown("service")}>
                  <Input
                    id={`${id}-service`}
                    value={draft.service}
                    onChange={(e) => set({ service: e.target.value })}
                    placeholder="Drain cleaning"
                    maxLength={120}
                    aria-invalid={shown("service") ? true : undefined}
                    className="h-10"
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
                <FormField id={`${id}-phone`} label="Phone (optional)">
                  <Input
                    id={`${id}-phone`}
                    type="tel"
                    value={draft.phone}
                    onChange={(e) => set({ phone: e.target.value })}
                    placeholder="(303) 555-0182"
                    autoComplete="off"
                    className="h-10"
                  />
                </FormField>
                <FormField
                  id={`${id}-email`}
                  label={draft.notify ? "Email" : "Email (optional)"}
                  problem={shown("email")}
                >
                  <Input
                    id={`${id}-email`}
                    type="email"
                    value={draft.email}
                    onChange={(e) => set({ email: e.target.value })}
                    placeholder="jane@email.com"
                    autoComplete="off"
                    aria-invalid={shown("email") ? true : undefined}
                    className="h-10"
                  />
                </FormField>
              </div>

              <fieldset className="space-y-2">
                <legend className="mb-1.5 text-sm font-medium">Address (optional)</legend>
                <div className="grid grid-cols-[1fr_5.5rem] gap-2">
                  <Input
                    aria-label="Street"
                    value={draft.street}
                    onChange={(e) => set({ street: e.target.value })}
                    placeholder="Street"
                    className="h-10"
                  />
                  <Input
                    aria-label="House number"
                    value={draft.number}
                    onChange={(e) => set({ number: e.target.value })}
                    placeholder="No."
                    className="h-10"
                  />
                </div>
                <div className="grid grid-cols-[1fr_4.5rem_5.5rem] gap-2">
                  <Input
                    aria-label="City"
                    value={draft.city}
                    onChange={(e) => set({ city: e.target.value })}
                    placeholder="City"
                    className="h-10"
                  />
                  <Input
                    aria-label="State"
                    value={draft.state}
                    onChange={(e) => set({ state: e.target.value })}
                    placeholder="State"
                    maxLength={2}
                    className="h-10"
                  />
                  <Input
                    aria-label="ZIP code"
                    inputMode="numeric"
                    value={draft.zip}
                    onChange={(e) => set({ zip: e.target.value.replace(/\D/g, "").slice(0, 5) })}
                    placeholder="ZIP"
                    aria-invalid={shown("zip") ? true : undefined}
                    className="h-10"
                  />
                </div>
                {shown("zip") && <p className="text-xs text-destructive">ZIP code: {shown("zip")}</p>}
              </fieldset>
            </>
          ) : timeOff ? (
            <div className="space-y-1.5">
              <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
                <FormField id={`${id}-from`} label="First day away">
                  <Input
                    id={`${id}-from`}
                    type="date"
                    value={draft.fromDate}
                    onChange={(e) =>
                      // The last day follows the first until it is set on its own, so a one-day
                      // absence is a single pick and a long one never starts out backwards.
                      set({
                        fromDate: e.target.value,
                        toDate: draft.toDate < e.target.value ? e.target.value : draft.toDate,
                      })
                    }
                    className="h-10"
                  />
                </FormField>
                <FormField id={`${id}-to`} label="Last day away">
                  <Input
                    id={`${id}-to`}
                    type="date"
                    value={draft.toDate}
                    min={draft.fromDate}
                    onChange={(e) => set({ toDate: e.target.value })}
                    className="h-10"
                  />
                </FormField>
              </div>
              {shown("time") && <p className="text-xs text-destructive">{shown("time")}</p>}
            </div>
          ) : (
            <FormField id={`${id}-title`} label="What is it?" problem={shown("title")}>
              <Input
                id={`${id}-title`}
                value={draft.title}
                onChange={(e) => set({ title: e.target.value })}
                placeholder="Supplier pickup"
                maxLength={120}
                aria-invalid={shown("title") ? true : undefined}
                className="h-10"
              />
            </FormField>
          )}

          {!timeOff && (
            <div className="space-y-1.5">
              <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-3">
                <FormField id={`${id}-date`} label="Day">
                  <Input
                    id={`${id}-date`}
                    type="date"
                    value={draft.date}
                    onChange={(e) => set({ date: e.target.value })}
                    className="h-10"
                  />
                </FormField>
                <FormField id={`${id}-start`} label="From">
                  <Input
                    id={`${id}-start`}
                    type="time"
                    value={draft.start}
                    onChange={(e) => set({ start: e.target.value })}
                    className="h-10"
                  />
                </FormField>
                <FormField id={`${id}-end`} label="To">
                  <Input
                    id={`${id}-end`}
                    type="time"
                    value={draft.end}
                    onChange={(e) => set({ end: e.target.value })}
                    className="h-10"
                  />
                </FormField>
              </div>
              {shown("time") && <p className="text-xs text-destructive">{shown("time")}</p>}
            </div>
          )}

          <FormField
            id={`${id}-notes`}
            label={
              appointment
                ? "What needs doing? (optional)"
                : timeOff
                  ? "Note for yourself (optional)"
                  : "Notes (optional)"
            }
          >
            <Textarea
              id={`${id}-notes`}
              value={draft.notes}
              onChange={(e) => set({ notes: e.target.value })}
              rows={3}
              maxLength={500}
            />
          </FormField>

          {appointment && (
            <div className="flex flex-col gap-2.5 rounded-2xl bg-brand-50/60 px-4 py-3">
              <CheckboxField
                label={`Send ${firstName} a confirmation by email`}
                checked={draft.notify}
                onCheckedChange={(notify) => set({ notify })}
              />
              <p className="-mt-1 pl-6.5 text-xs text-muted-ink">
                With the appointment attached for their calendar. It also shows in your conversation with them.
              </p>
              {prefill?.replaces && (
                <CheckboxField
                  label={`Replaces their request for ${format(prefill.replaces.date, "EEE, MMM d")} at ${prefill.replaces.time}`}
                  checked={draft.replaces}
                  onCheckedChange={(replaces) => set({ replaces })}
                />
              )}
            </div>
          )}

          {clashes.length > 0 && (
            <div
              role="status"
              className="rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-800"
            >
              <p className="font-semibold">
                {clashes.length === 1 ? "1 appointment falls" : `${clashes.length} appointments fall`} in this time:
              </p>
              <ul className="mt-1 list-disc pl-5">
                {clashes.map((a) => (
                  <li key={a.id}>
                    {format(appointmentStart(a), "EEE, MMM d, h:mm a")} — {a.customerName}, {a.service}
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-xs">They stay booked. Move or cancel them with the customer.</p>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <DialogClose render={<Button type="button" variant="outline" className="h-10 rounded-full px-5" />}>
              Cancel
            </DialogClose>
            <Button type="submit" className="h-10 rounded-full px-5">
              {timeOff
                ? "Add time off"
                : !appointment
                  ? "Block this time"
                  : draft.notify
                    ? "Book & send confirmation"
                    : "Book appointment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FormField({
  id,
  label,
  problem,
  children,
}: {
  id: string;
  label: string;
  problem?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {problem && <p className="text-xs text-destructive">{problem}</p>}
    </div>
  );
}

function KindOption({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "flex-1 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold transition-colors",
        active ? "bg-white text-brand shadow-sm" : "text-muted-ink hover:text-brand"
      )}
    >
      {children}
    </button>
  );
}
