import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { DASHBOARD_PATH } from "@/lib/routes";

import { DEMO_APPOINTMENTS } from "../demo-data";
import { CalendarMonth } from "./CalendarMonth";

export default function CalendarPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-8 py-10">
      <Link
        href={DASHBOARD_PATH}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-ink hover:text-brand-500"
      >
        <ArrowLeft className="size-3.5" />
        Back to dashboard
      </Link>

      <h1 className="mb-8 text-3xl font-bold tracking-[-0.02em] text-brand">Calendar</h1>

      <CalendarMonth appointments={DEMO_APPOINTMENTS} />
    </div>
  );
}
