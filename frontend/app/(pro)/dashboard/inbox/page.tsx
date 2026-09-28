import { INBOX_CONVERSATION_PARAM, INBOX_FILTER_PARAM } from "@/lib/routes";

import { DEMO_APPOINTMENTS, DEMO_MESSAGES } from "../demo-data";
import { InboxView } from "./InboxView";

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filter = params[INBOX_FILTER_PARAM] === "unread" ? "unread" : "all";
  const conversation = params[INBOX_CONVERSATION_PARAM];

  return (
    <div className="mx-auto w-full max-w-5xl px-8 py-10">
      <h1 className="mb-8 text-3xl font-bold tracking-[-0.02em] text-brand">Inbox</h1>
      <InboxView
        messages={DEMO_MESSAGES}
        appointments={DEMO_APPOINTMENTS}
        initialFilter={filter}
        initialConversationId={typeof conversation === "string" ? conversation : undefined}
      />
    </div>
  );
}
