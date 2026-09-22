import Link from "next/link";
import { isSameDay } from "date-fns";
import { ArrowRight, CalendarCheck, Clock3, Mail } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { fetchMyBusiness, fetchMyReadiness, fetchMyTrades } from "@/lib/api/business";
import { portalSession, portalToken } from "@/lib/portal/session";
import { WIZARD_PATH } from "@/lib/routes";

import { DashboardShell } from "./DashboardShell";
import { StatTile } from "./StatTile";
import { DEMO_APPOINTMENTS, DEMO_MESSAGES } from "./demo-data";

const today = new Date(new Date().setHours(0, 0, 0, 0));

export default async function DashboardPage() {
  const { user } = await portalSession();
  const token = await portalToken();

  const [business, trades, readiness] = await Promise.all([
    fetchMyBusiness(token),
    fetchMyTrades(token),
    fetchMyReadiness(token),
  ]);

  const primaryTrade = trades.ok ? trades.data?.primary?.displayName : undefined;
  const needsSetup = !business.ok || business.data === null || (readiness.ok && readiness.data?.ready === false);

  const todayCount = DEMO_APPOINTMENTS.filter((a) => isSameDay(a.date, today)).length;
  const pendingCount = DEMO_APPOINTMENTS.filter((a) => a.status === "pending").length;
  const unreadCount = DEMO_MESSAGES.filter((m) => m.unread).length;

  return (
    <DashboardShell appointments={DEMO_APPOINTMENTS} messages={DEMO_MESSAGES}>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-[-0.02em] text-brand">
            Welcome{user.firstName ? `, ${user.firstName}` : ""}
          </h1>
          <p className="mt-1 text-muted-ink">
            {primaryTrade ? `${primaryTrade} · ` : ""}
            Here&apos;s what&apos;s on today.
          </p>
        </div>
      </div>

      {needsSetup && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3">
          <p className="text-sm text-amber-800">
            Your profile isn&apos;t published yet — customers can&apos;t find or book you until it is.
          </p>
          <Link
            href={WIZARD_PATH}
            className={buttonVariants({ variant: "outline", size: "sm" }) + " gap-1.5 rounded-full border-line"}
          >
            Continue setup
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-3 min-[560px]:grid-cols-3">
        <StatTile icon={CalendarCheck} label="Today" value={todayCount} unit="appointment" />
        <StatTile icon={Clock3} label="Need your response" value={pendingCount} unit="request" accent />
        <StatTile icon={Mail} label="Unread" value={unreadCount} unit="message" />
      </div>
    </DashboardShell>
  );
}
