"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Mail, Trash2, X } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import type { Conversation as ConversationData, ConversationSummary } from "@/lib/api/inbox";
import { INBOX_CONVERSATION_PARAM, INBOX_FILTER_PARAM } from "@/lib/routes";
import { cn } from "@/lib/utils";

import { acceptRequest, bookAppointment, changeAppointment, declineRequest, removeAppointment, type Answered } from "../actions";
import { AppointmentDetail } from "../AppointmentDetail";
import { asSentence } from "../BookedNotice";
import {
  appointmentBody,
  changeBody,
  prefillFrom,
  type BookingPrefill,
  type BookResult,
  type NewBooking,
  type ServiceOption,
} from "../booking";
import { Conversation } from "../Conversation";
import { DeclineDialog } from "../DeclineDialog";
import type { DemoAppointment } from "../demo-data";
import { NewEntryDialog, type Editing } from "../NewEntryDialog";
import { asAppointment, type IncomingRequest } from "../requests";
import { listTime } from "../messageTime";
import { removeConversation, replyToCustomer } from "./actions";
import { appointmentOf, rowOf, threadOf } from "./live";

export type InboxFilter = "all" | "unread";

/**
 * The list and the conversation beside an open booking, from xl up, where the three sit in a row:
 * no height of their own — so neither the list nor the thread can make the row taller — and as
 * tall as the row, which the booking sets. The booking is shown whole and the page scrolls; the
 * other two scroll inside.
 */
const STRETCHED = "xl:h-0 xl:min-h-full";

/**
 * The inbox, on real conversations.
 *
 * The page reads everything on the server — the list, and the open conversation, marked read as
 * it is opened — so this component holds no copy of either. Picking a conversation changes the
 * address and the server answers; sending goes through a server action and the page reads again.
 * What lives here is only what is about the screen: the filter, and whether the booking column is
 * open.
 *
 * The booking column answers the request as the dashboard does — confirm or decline it while it
 * waits, change or remove it once it is booked — and the page reads again after each, so the
 * state on the chip is the server's.
 */
export function InboxView({
  conversations,
  open,
  request = null,
  services = [],
  initialFilter = "all",
}: {
  conversations: ConversationSummary[];
  /** The conversation being read, or null when there is none to show. */
  open: ConversationData | null;
  /** Its request in full, for answering or changing it; null leaves the booking read-only. */
  request?: IncomingRequest | null;
  /** The business's services, which a changed appointment is booked as. */
  services?: ServiceOption[];
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
  // The full request when there is one — it carries what changing it needs — the conversation's
  // own summary of it otherwise.
  const appointment = request ? asAppointment(request) : open ? appointmentOf(open) : undefined;
  const answerable = request !== null && appointment !== undefined;
  const detailsShown = open !== null && detailsFor === open.request.id;

  const [declining, setDeclining] = useState<DemoAppointment | null>(null);
  // The booking form: opened on the appointment to change, or on the customer to book another time.
  const [form, setForm] = useState<{ open: boolean; prefill?: BookingPrefill; editing?: Editing; key: number }>({
    open: false,
    key: 0,
  });
  const [answering, startAnswering] = useTransition();

  /** Done, the page reads again; refused, the reason is said over the conversation. */
  const answered = (failed: Answered) => {
    if (!failed.ok) {
      setProblem(`${asSentence(failed.message)}${failed.gone ? " Reload to see what is still open." : ""}`);
      return false;
    }
    setProblem(null);
    router.refresh();
    return true;
  };

  const confirm = (id: string) => startAnswering(async () => void answered(await acceptRequest(id)));

  const sendDecline = async (id: string, reason: string) => {
    if (answered(await declineRequest(id, reason))) setDeclining(null);
  };

  const removeBooked = async (id: string) => {
    answered(await removeAppointment(id));
  };

  const book = async (booking: NewBooking): Promise<BookResult> => {
    const changing = form.editing?.kind === "appointment" ? form.editing.appointment.id : undefined;
    const answer = changing
      ? await changeAppointment(changing, changeBody(booking))
      : await bookAppointment(appointmentBody(booking));

    if (answer.kind !== "saved") return answer;
    setProblem(null);
    router.refresh();
    return { kind: "saved" };
  };

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, startDeleting] = useTransition();

  /** Out of the inbox, and the conversation closed: nothing is left open that is no longer listed. */
  const remove = (requestId: string) =>
    startDeleting(async () => {
      const failed = await removeConversation(requestId);
      setConfirmingDelete(false);
      if (failed) {
        setProblem(failed);
        return;
      }
      const next = new URLSearchParams(searchParams);
      next.delete(INBOX_CONVERSATION_PARAM);
      router.replace(`${pathname}?${next}`, { scroll: false });
      router.refresh();
    });

  const pick = (id: string) => {
    const next = new URLSearchParams(searchParams);
    next.set(INBOX_CONVERSATION_PARAM, id);
    setProblem(null);
    setConfirmingDelete(false);
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
    <>
      <DeclineDialog
        key={declining?.id ?? "none"}
        request={declining}
        onOpenChange={(isOpen) => !isOpen && setDeclining(null)}
        onDecline={sendDecline}
      />

      <NewEntryDialog
        key={form.key}
        open={form.open}
        onOpenChange={(isOpen) => setForm((f) => ({ ...f, open: isOpen }))}
        day={new Date(new Date().setHours(0, 0, 0, 0))}
        services={services}
        prefill={form.prefill}
        editing={form.editing}
        onBook={book}
      />

      <div
        className={cn(
          "grid grid-cols-1 items-start gap-4",
          detailsShown
            ? "lg:grid-cols-[300px_1fr] xl:grid-cols-[300px_1fr_340px] xl:items-stretch"
            : "lg:grid-cols-[360px_1fr]"
        )}
      >
        {/*
          As tall as the conversation beside it, and scrolling inside: the list grows with every
          request, and the page should not grow with it.
        */}
        <Card
          className={cn(
            "flex h-[min(640px,calc(100dvh-8rem))] flex-col gap-0 rounded-3xl border border-line bg-white py-2 shadow-card",
            detailsShown && STRETCHED
          )}
        >
          <div role="tablist" aria-label="Show" className="mx-2 mb-2 mt-1 flex gap-1 rounded-full bg-brand-50 p-1">
            <FilterTab active={filter === "all"} onClick={() => changeFilter("all")}>
              All
            </FilterTab>
            <FilterTab active={filter === "unread"} onClick={() => changeFilter("unread")}>
              Unread{unreadCount > 0 && ` (${unreadCount})`}
            </FilterTab>
          </div>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2">
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

        <Card
          className={cn(
            "gap-4 rounded-3xl border border-line bg-white py-0 shadow-card lg:sticky lg:top-4",
            detailsShown && cn(STRETCHED, "xl:static")
          )}
        >
          <CardContent
            className={cn(
              "flex h-[min(640px,calc(100dvh-8rem))] flex-col px-6 py-6",
              detailsShown && "xl:h-auto xl:min-h-0 xl:flex-1"
            )}
          >
            {open && thread ? (
              <>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="text-xl font-bold tracking-[-0.01em] text-brand">{open.customerName}</h2>
                  {!confirmingDelete && (
                    <button
                      type="button"
                      onClick={() => setConfirmingDelete(true)}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-muted-ink transition-colors hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                      Delete
                    </button>
                  )}
                </div>
                {/* Asked once more, saying what it does and does not do, before it is done. */}
                {confirmingDelete && (
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3">
                    <p className="m-0 text-sm text-brand">
                      Delete this conversation from your inbox? It comes back if {open.customerName} writes again.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmingDelete(false)}
                        disabled={deleting}
                        className="rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold text-muted-ink"
                      >
                        Keep it
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(open.request.id)}
                        disabled={deleting}
                        className="rounded-full bg-destructive px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        {deleting ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </div>
                )}
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
          // Shown whole, never scrolling inside: from xl up, where the three sit side by side, it sets
          // the row's height — no less than the inbox's usual — and the other two stretch to it.
          <Card className="gap-0 rounded-3xl border border-line bg-white py-0 shadow-card duration-200 animate-in fade-in slide-in-from-right-4 lg:col-span-2 xl:col-span-1 xl:min-h-[min(640px,calc(100dvh-8rem))]">
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
              {/* Keyed on the request and its state, so a question half asked does not outlive the answer. */}
              <AppointmentDetail
                key={`${appointment.id}-${appointment.status}`}
                appointment={appointment}
                {...(answerable && {
                  onConfirm: (id: string) => !answering && confirm(id),
                  onDecline: () => setDeclining(appointment),
                  onRebook: (a: DemoAppointment) =>
                    setForm((f) => ({ open: true, prefill: prefillFrom(a), key: f.key + 1 })),
                  onChange: (a: DemoAppointment) =>
                    setForm((f) => ({ open: true, editing: { kind: "appointment", appointment: a }, key: f.key + 1 })),
                  onRemove: removeBooked,
                })}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </>
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
