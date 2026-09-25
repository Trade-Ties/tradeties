import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { CALENDAR_NEW_PARAM, CALENDAR_VIEW_PARAM, DASHBOARD_PATH } from "@/lib/routes";

import { DEMO_APPOINTMENTS, DEMO_ENTRIES, DEMO_TIME_OFF } from "../demo-data";
import { CalendarMonth } from "./CalendarMonth";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const view = params[CALENDAR_VIEW_PARAM] === "requests" ? "requests" : "day";

  return (
    <div className="mx-auto w-full max-w-5xl px-8 py-10">
      <Link
        href={DASHBOARD_PATH}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-ink hover:text-brand-500"
      >
        <ArrowLeft className="size-3.5" />
        Back to dashboard
      </Link>

      <CalendarMonth
        appointments={DEMO_APPOINTMENTS}
        entries={DEMO_ENTRIES}
        timeOff={DEMO_TIME_OFF}
        initialView={view}
        openOnTimeOff={params[CALENDAR_NEW_PARAM] === "time-off"}
      />
    </div>
  );
}
