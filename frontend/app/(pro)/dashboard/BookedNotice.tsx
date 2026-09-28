import { CircleCheck, X } from "lucide-react";

/** The line that says a booking went through, and whether the customer is being told about it. */
export function BookedNotice({ children, onDismiss }: { children: React.ReactNode; onDismiss: () => void }) {
  return (
    <div
      role="status"
      className="mb-4 flex items-center gap-2.5 rounded-2xl border border-go/30 bg-go-bg px-4 py-3 text-sm text-[#07734F]"
    >
      <CircleCheck className="size-4 shrink-0" />
      <p className="flex-1">{children}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="grid size-6 shrink-0 place-items-center rounded-full hover:bg-go/10"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
