import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { fetchMyServices, fetchMyWorkingHours } from "@/lib/api/business";
import { fetchMyTimeOff } from "@/lib/api/calendar";
import { fetchMyJobRequests } from "@/lib/api/inbox";
import { portalToken } from "@/lib/portal/session";
import { CALENDAR_NEW_PARAM, CALENDAR_VIEW_PARAM, DASHBOARD_PATH } from "@/lib/routes";

import { serviceOptionsOf } from "../booking";
import { incoming } from "../requests";
import { CalendarMonth } from "./CalendarMonth";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const view = params[CALENDAR_VIEW_PARAM] === "requests" ? "requests" : "day";
  const token = await portalToken();

  // The same lists the dashboard reads, and it has to be the same: accepting on one screen and
  // still seeing the hour free on the other is the state this slice exists to remove.
  const [sent, blocked, services, workingHours] = await Promise.all([
    fetchMyJobRequests(token),
    fetchMyTimeOff(token),
    fetchMyServices(token),
    fetchMyWorkingHours(token),
  ]);
  const requests = (sent.ok ? sent.data : [])
    .filter((request) => request.status === "PENDING" || request.status === "ACCEPTED")
    .map(incoming);

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
        sent={requests}
        blocks={blocked.ok ? blocked.data : []}
        services={serviceOptionsOf(services.ok ? services.data : null)}
        workingHours={workingHours.ok ? workingHours.data : null}
        initialView={view}
        openOnTimeOff={params[CALENDAR_NEW_PARAM] === "time-off"}
      />
    </div>
  );
}
