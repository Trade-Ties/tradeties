import { DEMO_MESSAGES } from "../demo-data";
import { InboxView } from "./InboxView";

export default function InboxPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-8 py-10">
      <h1 className="mb-8 text-3xl font-bold tracking-[-0.02em] text-brand">Inbox</h1>
      <InboxView messages={DEMO_MESSAGES} />
    </div>
  );
}
