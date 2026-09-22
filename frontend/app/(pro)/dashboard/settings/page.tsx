import Link from "next/link";
import { Bell, CalendarClock, Clock3, LogOut, Sliders, User as UserIcon } from "lucide-react";

import { signOutFromPortal } from "../actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchMyBookingPolicy, fetchMyWorkingHours } from "@/lib/api/business";
import { portalSession, portalToken } from "@/lib/portal/session";
import { WIZARD_PATH } from "@/lib/routes";
import { DAYS_OF_WEEK, dayName, formatTime } from "@/components/profile/time";

export default async function SettingsPage() {
  const { user } = await portalSession();
  const token = await portalToken();

  const [workingHours, bookingPolicy] = await Promise.all([
    fetchMyWorkingHours(token),
    fetchMyBookingPolicy(token),
  ]);

  return (
    <div className="mx-auto w-full max-w-5xl px-8 py-10">
      <h1 className="mb-8 text-3xl font-bold tracking-[-0.02em] text-brand">Settings</h1>

      <div className="flex flex-col gap-4">
        <Card className="gap-4 rounded-3xl border border-line bg-white py-0 shadow-card">
          <CardHeader className="px-5 pt-5">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <UserIcon className="size-4 text-brand-500" />
              Account
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-4 px-5 pb-5">
            <div>
              <p className="text-sm font-medium">
                {[user.firstName, user.lastName].filter(Boolean).join(" ") || "Your account"}
              </p>
              <p className="text-sm text-muted-ink">{user.email}</p>
            </div>
            <form action={signOutFromPortal}>
              <button
                type="submit"
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line px-4 text-sm font-semibold text-muted-ink hover:bg-brand-50 hover:text-brand-500"
              >
                <LogOut className="size-3.5" />
                Sign out
              </button>
            </form>
          </CardContent>
        </Card>

        <Card className="gap-4 rounded-3xl border border-line bg-white py-0 shadow-card">
          <CardHeader className="flex flex-row items-center justify-between px-5 pt-5">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Clock3 className="size-4 text-brand-500" />
              Working hours
            </CardTitle>
            <Link href={WIZARD_PATH} className="text-xs font-semibold text-brand-500 hover:underline">
              Edit
            </Link>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {workingHours.ok && workingHours.data ? (
              <dl className="flex flex-col gap-2">
                {DAYS_OF_WEEK.map((dow) => {
                  const day = workingHours.data!.days.find((d) => d.dayOfWeek === dow);
                  const blocks = day?.blocks ?? [];
                  return (
                    <div key={dow} className="flex items-center justify-between border-b border-line py-1.5 text-sm last:border-0">
                      <dt className="text-muted-ink">{dayName(dow)}</dt>
                      <dd className={blocks.length === 0 ? "text-faint" : "font-medium"}>
                        {blocks.length === 0
                          ? "Closed"
                          : blocks.map((b) => `${formatTime(b.startsAt)}–${formatTime(b.endsAt)}`).join(", ")}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            ) : (
              <p className="text-sm text-muted-ink">
                Not set up yet.{" "}
                <Link href={WIZARD_PATH} className="font-semibold text-brand-500 hover:underline">
                  Finish setup
                </Link>{" "}
                to set your working hours.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="gap-4 rounded-3xl border border-line bg-white py-0 shadow-card">
          <CardHeader className="flex flex-row items-center justify-between px-5 pt-5">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <CalendarClock className="size-4 text-brand-500" />
              Booking policy
            </CardTitle>
            <Link href={WIZARD_PATH} className="text-xs font-semibold text-brand-500 hover:underline">
              Edit
            </Link>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {bookingPolicy.ok && bookingPolicy.data ? (
              <dl className="grid grid-cols-1 gap-3 text-sm min-[560px]:grid-cols-2">
                <Row label="Booking horizon">{bookingPolicy.data.bookingHorizonDays} days ahead</Row>
                <Row label="Minimum lead time">{bookingPolicy.data.minLeadTimeHours} hours</Row>
                <Row label="Daily booking limit">
                  {bookingPolicy.data.maxAcceptedAppointmentsPerDay ?? "No limit"}
                </Row>
                <Row label="Slot length">{bookingPolicy.data.slotGranularityMinutes} minutes</Row>
                <Row label="Buffer between jobs">{bookingPolicy.data.appointmentBufferMinutes} minutes</Row>
              </dl>
            ) : (
              <p className="text-sm text-muted-ink">
                Not set up yet.{" "}
                <Link href={WIZARD_PATH} className="font-semibold text-brand-500 hover:underline">
                  Finish setup
                </Link>{" "}
                to set your booking policy.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="gap-4 rounded-3xl border border-line bg-white py-0 shadow-card">
          <CardHeader className="flex flex-row items-center justify-between px-5 pt-5">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Bell className="size-4 text-brand-500" />
              Notifications
            </CardTitle>
            <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-500">
              Coming soon
            </span>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 px-5 pb-5 opacity-50">
            <ToggleRow label="Email me about new booking requests" />
            <ToggleRow label="Text me when a customer messages" />
            <ToggleRow label="Weekly performance summary" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="flex items-center gap-1.5 text-muted-ink">
        <Sliders className="size-3.5" />
        {label}
      </dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}

function ToggleRow({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span>{label}</span>
      <span className="h-5 w-9 rounded-full bg-line" aria-hidden="true">
        <span className="block size-4 translate-x-0.5 translate-y-0.5 rounded-full bg-white shadow-sm" />
      </span>
    </div>
  );
}
