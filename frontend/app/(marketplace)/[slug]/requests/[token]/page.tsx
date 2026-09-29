import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, Mail, MapPin, MessageSquare, Phone, Wrench } from "lucide-react";

import { SiteFooter } from "@/components/marketing/SiteFooter";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { dayLabel, dayOf, spanLabel } from "@/components/marketing/availability";
import { money } from "@/components/marketing/business-format";
import { getJobByToken, type CustomerJob, type JobRequestSummary, type Message } from "@/lib/api/marketplace";
import { proPath } from "@/lib/routes";
import { cn } from "@/lib/utils";

import { sendReply, type SendState } from "./actions";
import { ReplyForm } from "./ReplyForm";

/**
 * The page behind a customer's link: what they asked for, and where it stands.
 *
 * <p>A customer has no account, so the token in this address is the whole of their access. The
 * page therefore keeps it as close as it can: it is not indexed, it sends no referrer — a link
 * followed from here must not carry the token to wherever it leads — and it reads the request on
 * the server, handing the token to the API in a header rather than in another URL.
 *
 * <p>The business in the path is the one the request went to, as the booking form and the email
 * spell the link. It is not what opens the page — the token is — so a request is found even if
 * that part of the address has since stopped matching.
 */
export const metadata: Metadata = {
  title: "Your request · TradeTies",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function CustomerRequestPage({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = await params;
  const result = await getJobByToken(token);

  if (!result.ok) {
    return (
      <>
        <SiteHeader />
        <section className="mx-auto max-w-[560px] px-6 py-20 text-center">
          <h1 className="text-[24px] font-semibold tracking-tight text-brand">
            We couldn&apos;t load your request just now.
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-muted-ink">
            That is on us, not your link. Reloading in a moment usually works.
          </p>
        </section>
        <SiteFooter />
      </>
    );
  }

  // Never issued and expired are one answer, here as in the API.
  if (result.data === null) {
    notFound();
  }

  return (
    <>
      <SiteHeader />
      <RequestPage job={result.data} token={token} path={`/${slug}/requests/${token}`} />
      <SiteFooter />
    </>
  );
}

function RequestPage({ job, token, path }: { job: CustomerJob; token: string; path: string }) {
  const firstName = job.customerName.trim().split(" ")[0];

  return (
    <section className="mx-auto w-full max-w-[760px] px-6 pb-20 pt-8">
      <p className="text-[13px] font-semibold uppercase tracking-wide text-faint">Your request</p>
      <h1 className="mt-1 text-[28px] font-bold tracking-[-0.02em] text-brand">Hi {firstName}.</h1>

      <div className="mt-6 flex flex-col gap-4">
        {job.requests.map(({ request, messages }) => (
          <div key={request.id} className="flex flex-col gap-4">
            <RequestCard request={request} />
            <ConversationCard
              request={request}
              messages={messages}
              description={job.description}
              action={sendReply.bind(null, token, request.id, path)}
            />
          </div>
        ))}

        <Card>
          <Heading icon={MapPin}>Where and how to reach you</Heading>
          <dl className="m-0 grid grid-cols-1 gap-x-8 gap-y-3 text-[14px] sm:grid-cols-2">
            <Detail label="Address">
              {[job.address.street1, job.address.street2].filter(Boolean).join(", ")}
              <br />
              {job.address.city}, {job.address.state} {job.address.postalCode}
            </Detail>
            <Detail label="Contact">
              <span className="flex items-center gap-1.5">
                <Mail className="size-3.5 text-faint" aria-hidden="true" />
                {job.customerEmail}
              </span>
              {job.customerPhone && (
                <span className="mt-1 flex items-center gap-1.5">
                  <Phone className="size-3.5 text-faint" aria-hidden="true" />
                  {job.customerPhone}
                </span>
              )}
            </Detail>
          </dl>
        </Card>

        <p className="m-0 mt-2 text-[12.5px] leading-relaxed text-faint">
          This page is your way back to the request — no account needed. Keep the link to yourself:
          anyone who has it can read it. It works until{" "}
          {new Date(job.accessTokenExpiresAt).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
          .
        </p>
      </div>
    </section>
  );
}

/** What each status means for the person waiting on it, not what the system calls it. */
const STATUS: Record<JobRequestSummary["status"], { label: (business: string) => string; tone: string }> = {
  PENDING: { label: (b) => `Waiting for ${b} to confirm`, tone: "bg-amber-500/15 text-amber-800" },
  ACCEPTED: { label: () => "Confirmed", tone: "bg-go-bg text-[#07734F]" },
  DECLINED: { label: (b) => `${b} can't take this one`, tone: "bg-destructive/10 text-destructive" },
  WITHDRAWN: { label: () => "You withdrew this request", tone: "bg-slate-100 text-muted-ink" },
  CANCELLED: { label: () => "Cancelled", tone: "bg-slate-100 text-muted-ink" },
  COMPLETED: { label: () => "Done", tone: "bg-go-bg text-[#07734F]" },
};

function RequestCard({ request }: { request: JobRequestSummary }) {
  const status = STATUS[request.status];
  const free = Number(request.cancellationFee) === 0;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="m-0 text-[13px] text-muted-ink">Sent to</p>
          <p className="m-0 text-[20px] font-bold tracking-[-0.02em] text-brand">
            {request.businessSlug ? (
              <Link href={proPath(request.businessSlug)} className="text-brand no-underline hover:text-brand-500">
                {request.businessName}
              </Link>
            ) : (
              request.businessName
            )}
          </p>
        </div>
        <span className={cn("rounded-full px-3 py-1 text-[12.5px] font-semibold", status.tone)}>
          {status.label(request.businessName)}
        </span>
      </div>

      <dl className="m-0 mt-5 grid grid-cols-1 gap-x-8 gap-y-3 text-[14px] sm:grid-cols-2">
        <Detail label="Job">{request.serviceName}</Detail>
        <Detail label="When">
          <span className="flex items-start gap-1.5">
            <CalendarClock className="mt-0.5 size-3.5 shrink-0 text-faint" aria-hidden="true" />
            <span>
              {dayLabel(dayOf(request.startsAt, request.timeZone))},{" "}
              {spanLabel(request.startsAt, request.estimatedDurationMinutes, request.timeZone)}
              <span className="block text-[12.5px] text-faint">Times in {request.timeZone}</span>
            </span>
          </span>
        </Detail>
        <Detail label="If you cancel">
          {free
            ? "Free"
            : `${money(request.cancellationFee)} within ${request.cancellationNoticeHours} hours of the start`}
        </Detail>
      </dl>

      {request.status === "PENDING" && (
        <p className="m-0 mt-5 rounded-2xl bg-canvas px-4 py-3 text-[13.5px] leading-relaxed text-muted-ink">
          Nothing is booked yet. The time stays open to others until {request.businessName}{" "}
          confirms — you&apos;ll get an email either way.
        </p>
      )}
    </Card>
  );
}

/**
 * The conversation with the business, starting from what the customer wrote when they sent the
 * request — the line the tradesperson read first, and the one everything after it answers.
 */
function ConversationCard({
  request,
  messages,
  description,
  action,
}: {
  request: JobRequestSummary;
  messages: Message[];
  description: string;
  action: (previous: SendState, form: FormData) => Promise<SendState>;
}) {
  return (
    <Card>
      <Heading icon={MessageSquare}>Messages with {request.businessName}</Heading>

      <ol className="m-0 flex list-none flex-col gap-3 p-0">
        <Bubble mine label="You, with your request">
          {description}
        </Bubble>
        {messages.map((message) => (
          <Bubble
            key={message.id}
            mine={message.author === "CUSTOMER"}
            label={`${message.author === "CUSTOMER" ? "You" : request.businessName} · ${sentLabel(message.sentAt, request.timeZone)}`}
          >
            {message.body}
          </Bubble>
        ))}
      </ol>

      {messages.length === 0 && (
        <p className="m-0 mt-3 text-[13px] text-muted-ink">
          No reply yet. When {request.businessName} writes, you&apos;ll get an email and it shows up here.
        </p>
      )}

      <ReplyForm action={action} businessName={request.businessName} />
    </Card>
  );
}

/** The customer's own lines on the right, the business's on the left — as in any messenger. */
function Bubble({ mine, label, children }: { mine: boolean; label: string; children: React.ReactNode }) {
  return (
    <li className={cn("flex max-w-[85%] flex-col gap-1", mine ? "items-end self-end" : "items-start")}>
      <p
        className={cn(
          "m-0 whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed",
          mine ? "rounded-br-md bg-brand text-white" : "rounded-bl-md bg-brand-50 text-foreground"
        )}
      >
        {children}
      </p>
      <span className="px-1 text-[11.5px] text-faint">{label}</span>
    </li>
  );
}

/** "Mon, Oct 5, 2:14 PM", on the business's clock like every other time on this page. */
function sentLabel(instant: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(instant));
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-3xl border border-line bg-white p-6", className)}>{children}</div>;
}

function Heading({ icon: Icon, children }: { icon: typeof Wrench; children: React.ReactNode }) {
  return (
    <h2 className="m-0 mb-3 flex items-center gap-2 text-[15px] font-semibold text-brand">
      <Icon className="size-4 text-brand-500" aria-hidden="true" />
      {children}
    </h2>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[12.5px] text-muted-ink">{label}</dt>
      <dd className="m-0 mt-0.5 font-medium text-foreground">{children}</dd>
    </div>
  );
}
