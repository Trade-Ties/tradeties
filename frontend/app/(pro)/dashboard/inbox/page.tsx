import { AlertCircle } from "lucide-react";

import { getConversation, listConversations, markConversationRead } from "@/lib/api/inbox";
import { portalToken } from "@/lib/portal/session";
import { INBOX_CONVERSATION_PARAM, INBOX_FILTER_PARAM } from "@/lib/routes";

import { InboxView } from "./InboxView";

/**
 * The inbox, read on the server: every conversation, and the one being read.
 *
 * Opening a conversation is what marks it read, so that happens here, before the list's unread
 * counts are shown — the badge and the dot agree with what is on screen.
 */
export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filter = params[INBOX_FILTER_PARAM] === "unread" ? "unread" : "all";
  const asked = params[INBOX_CONVERSATION_PARAM];

  const token = await portalToken();
  const listed = await listConversations(token);

  if (!listed.ok) {
    return (
      <Frame>
        <p className="flex items-center gap-2 rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          Your inbox could not be loaded just now. Reloading usually works.
        </p>
      </Frame>
    );
  }

  // The one asked for, or the newest — the inbox opens on something to read.
  const openId = typeof asked === "string" ? asked : listed.data[0]?.requestId;
  let open = null;

  if (openId) {
    await markConversationRead(token, openId);
    const read = await getConversation(token, openId);
    open = read.ok ? read.data : null;
  }

  // Read before it was marked; the one now open has nothing unread any more.
  const conversations = listed.data.map((entry) =>
    entry.requestId === open?.request.id ? { ...entry, unreadCount: 0 } : entry
  );

  return (
    <Frame>
      <InboxView conversations={conversations} open={open} initialFilter={filter} />
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-7xl px-8 py-10">
      <h1 className="mb-8 text-3xl font-bold tracking-[-0.02em] text-brand">Inbox</h1>
      {children}
    </div>
  );
}
