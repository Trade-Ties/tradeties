import Link from "next/link";
import { ArrowRight, CalendarCheck, Clock3, Mail } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { fetchMyBusiness, fetchMyReadiness, fetchMyServices, fetchMyTrades } from "@/lib/api/business";
import { fetchMyTimeOff } from "@/lib/api/calendar";
import { fetchMyJobRequests, listConversations } from "@/lib/api/inbox";
import { dayOf } from "@/components/marketing/availability";
import { portalSession, portalToken } from "@/lib/portal/session";
import { CALENDAR_PATH, CALENDAR_REQUESTS_PATH, INBOX_UNREAD_PATH, WIZARD_PATH } from "@/lib/routes";

import { serviceOptionsOf } from "./booking";
import { DashboardShell } from "./DashboardShell";
import { StatTile } from "./StatTile";
import { incoming } from "./requests";
import { messageOf } from "./inbox/live";
import { ComingSoonTag } from "./ComingSoon";
import { RatingBadge } from "./RatingBadge";

export default async function DashboardPage() {
  const { user } = await portalSession();
  const token = await portalToken();

  const [business, trades, readiness, sent, blocked, services, conversations] = await Promise.all([
    fetchMyBusiness(token),
    fetchMyTrades(token),
    fetchMyReadiness(token),
    fetchMyJobRequests(token),
    fetchMyTimeOff(token),
    fetchMyServices(token),
    listConversations(token),
  ]);
  // The real inbox, latest first, in the card's shape — a handful is all the card has room for.
  const messages = (conversations.ok ? conversations.data : []).map(messageOf);

  const primaryTrade = trades.ok ? trades.data?.primary?.displayName : undefined;
  const needsSetup = !business.ok || business.data === null || (readiness.ok && readiness.data?.ready === false);

  /*
    Only the two states the calendar draws: a declined, withdrawn or cancelled request no longer
    holds any time.

    A business with no profile answers 404 rather than an empty list, which is the same thing to
    this page — there is nothing to show either way, and the setup banner below says why.
  */
  const requests = (sent.ok ? sent.data : [])
    .filter((request) => request.status === "PENDING" || request.status === "ACCEPTED")
    .map(incoming);

  // Compared as day strings rather than as dates, for the reason `requests.ts` gives: each day
  // was worked out on the business's clock, so "today" has to be read on the same one. The
  // server's date would be a different day for an evening appointment in Denver.
  const zone = business.ok && business.data ? business.data.timeZone : null;
  const todayThere = zone ? dayOf(new Date().toISOString(), zone) : null;

  const todayCount = requests.filter((request) => request.day === todayThere).length;
  const pendingCount = requests.filter((request) => request.status === "pending").length;
  const unreadCount = messages.filter((m) => m.unread).length;

  return (
    <DashboardShell
      requests={requests}
      blocks={blocked.ok ? blocked.data : []}
      services={serviceOptionsOf(services.ok ? services.data : null)}
      messages={messages.slice(0, 6)}
      // Over the cards they count: today's appointments over the schedule, the requests and the
      // unread messages sharing the inbox's width — so the tiles' edges are the cards' edges.
      overSchedule={
        <StatTile icon={CalendarCheck} label="Today" value={todayCount} unit="appointment" href={CALENDAR_PATH} />
      }
      overInbox={
        <>
          <StatTile
            icon={Clock3}
            label="Need your response"
            value={pendingCount}
            unit="request"
            accent
            href={CALENDAR_REQUESTS_PATH}
          />
          <StatTile icon={Mail} label="Unread" value={unreadCount} unit="message" href={INBOX_UNREAD_PATH} />
        </>
      }
    >
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
        {/*
          Reviews are not live yet: no review is real, so it shows none — greyed and out of reach,
          under the same tag every coming-soon part of the portal carries.
        */}
        <div className="flex flex-col items-end gap-1.5">
          <ComingSoonTag />
          <div aria-hidden="true" inert className="pointer-events-none select-none opacity-50 grayscale">
            <RatingBadge reviews={[]} />
          </div>
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

    </DashboardShell>
  );
}
