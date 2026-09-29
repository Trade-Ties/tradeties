"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Mail, X } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import type { Conversation as ConversationData, ConversationSummary } from "@/lib/api/inbox";
import { INBOX_CONVERSATION_PARAM, INBOX_FILTER_PARAM } from "@/lib/routes";
import { cn } from "@/lib/utils";

import { AppointmentDetail } from "../AppointmentDetail";
import { Conversation } from "../Conversation";
import { listTime } from "../messageTime";
import { replyToCustomer } from "./actions";
import { appointmentOf, rowOf, threadOf } from "./live";

export type InboxFilter = "all" | "unread";

/**
 * The inbox, on real conversations.
 *
 * The page reads everything on the server — the list, and the open conversation, marked read as
 * it is opened — so this component holds no copy of either. Picking a conversation changes the
 * address and the server answers; sending goes through a server action and the page reads again.
 * What lives here is only what is about the screen: the filter, and whether the booking column is
 * open.
 *
 * Confirming and declining a request are not offered here yet: they are the booking's decisions,
 * and they arrive with it.
 */
export function InboxView({
  conversations,
  open,
  initialFilter = "all",
}: {
  conversations: ConversationSummary[];
  /** The conversation being read, or null when there is none to show. */
  open: ConversationData | null;
  initialFilter?: InboxFilter;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [filter, setFilter] = useState<InboxFilter>(initialFilter);
  const [detailsFor, setDetailsFor] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [sending, startSending] = useTransition();

  const rows = conversations.map(rowOf);
  const openId = open?.request.id;
  const unreadCount = rows.filter((row) => row.unread).length;
  // The open conversation stays in the unread list after opening marked it read, so it does not
  // vanish from under the pointer; it drops out once another one is picked.
  const listed = filter === "all" ? rows : rows.filter((row) => row.unread || row.id === openId);

  const thread = open ? threadOf(open) : null;
  const appointment = open ? appointmentOf(open) : undefined;
  const detailsShown = open !== null && detailsFor === open.request.id;

  const pick = (id: string) => {
    const next = new URLSearchParams(searchParams);
    next.set(INBOX_CONVERSATION_PARAM, id);
    setProblem(null);
    router.push(`${pathname}?${next}`);
  };

  const changeFilter = (value: InboxFilter) => {
    setFilter(value);
    const next = new URLSearchParams(searchParams);
    if (value === "unread") next.set(INBOX_FILTER_PARAM, "unread");
    else next.delete(INBOX_FILTER_PARAM);
    router.replace(`${pathname}?${next}`, { scroll: false });
  };

  const send = (requestId: string, text: string) =>
    startSending(async () => {
      const failed = await replyToCustomer(requestId, text);
      setProblem(failed);
      if (!failed) router.refresh();
    });

  return (
    <div
      className={cn(
        "grid grid-cols-1 items-start gap-4",
        detailsShown ? "lg:grid-cols-[300px_1fr] xl:grid-cols-[300px_1fr_340px]" : "lg:grid-cols-[360px_1fr]"
      )}
    >
      <Card className="gap-0 rounded-3xl border border-line bg-white py-2 shadow-card">
        <div role="tablist" aria-label="Show" className="mx-2 mb-2 mt-1 flex gap-1 rounded-full bg-brand-50 p-1">
          <FilterTab active={filter === "all"} onClick={() => changeFilter("all")}>
            All
          </FilterTab>
          <FilterTab active={filter === "unread"} onClick={() => changeFilter("unread")}>
            Unread{unreadCount > 0 && ` (${unreadCount})`}
          </FilterTab>
        </div>
        <CardContent className="flex flex-col gap-1 px-2">
          {listed.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-ink">
              {filter === "unread"
                ? "You're all caught up — nothing unread."
                : "No requests yet. When a customer sends one, the conversation starts here."}
            </p>
          )}
          {listed.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => pick(row.id)}
              className={cn(
                "flex w-full flex-col gap-0.5 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-brand-50",
                row.id === openId && "bg-brand-50"
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn("size-1.5 shrink-0 rounded-full", row.unread ? "bg-brand-500" : "bg-transparent")}
                />
                <p className={row.unread ? "truncate text-sm font-semibold" : "truncate text-sm font-medium"}>
                  {row.customerName}
                </p>
                <time
                  dateTime={row.sentAt.toISOString()}
                  suppressHydrationWarning
                  className="ml-auto shrink-0 text-[11px] text-faint"
                >
                  {listTime(row.sentAt)}
                </time>
              </div>
              <p className="truncate pl-3.5 text-xs text-muted-ink">
                {row.fromBusiness && "You: "}
                {row.preview}
              </p>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card className="gap-4 rounded-3xl border border-line bg-white py-0 shadow-card lg:sticky lg:top-4">
        <CardContent className="flex h-[min(640px,calc(100dvh-8rem))] flex-col px-6 py-6">
          {open && thread ? (
            <>
              <h2 className="mb-3 text-xl font-bold tracking-[-0.01em] text-brand">{open.customerName}</h2>
              {problem && (
                <p className="mb-2 flex items-center gap-2 rounded-xl bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  <AlertCircle className="size-3.5 shrink-0" />
                  {problem}
                </p>
              )}
              <Conversation
                // Keyed on the request, so a draft does not follow the pointer to the next one.
                key={open.request.id}
                conversation={thread}
                appointment={appointment}
                onSend={(requestId, text) => send(requestId, text)}
                onOpenDetails={() => setDetailsFor(detailsShown ? null : open.request.id)}
                detailsOpen={detailsShown}
              />
              {sending && <p className="mt-2 text-xs text-muted-ink">Sending…</p>}
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-muted-ink">
              <Mail className="size-6" />
              <p className="text-sm">
                {conversations.length === 0 ? "Nothing to read yet." : "Select a conversation to read it."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {detailsShown && appointment && (
        <Card className="gap-0 rounded-3xl border border-line bg-white py-0 shadow-card duration-200 animate-in fade-in slide-in-from-right-4 lg:col-span-2 xl:sticky xl:top-4 xl:col-span-1">
          <CardContent className="px-5 py-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-faint">Booking</p>
              <button
                type="button"
                onClick={() => setDetailsFor(null)}
                aria-label="Close booking details"
                className="grid size-7 shrink-0 place-items-center rounded-full text-muted-ink hover:bg-brand-50 hover:text-brand-500"
              >
                <X className="size-4" />
              </button>
            </div>
            {/* No confirm or decline: those are the booking's decisions, and arrive with it. */}
            <AppointmentDetail appointment={appointment} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function FilterTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
        active ? "bg-white text-brand shadow-sm" : "text-muted-ink hover:text-brand"
      )}
    >
      {children}
    </button>
  );
}
