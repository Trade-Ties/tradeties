import { cn } from "@/lib/utils";

/**
 * The mark + wordmark, shared between the marketing header and the
 * professional portal's sidebar so both read as the same product instead of
 * drifting into two slightly different treatments over time.
 */
export function Logo({ className, wordmarkClassName }: { className?: string; wordmarkClassName?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5 text-[20px] font-extrabold tracking-[-0.025em] text-brand", className)}>
      <span className="grid size-[26px] shrink-0 place-items-center rounded-lg bg-brand">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M2 7.5 L5.5 11 L12 3.5" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className={cn("truncate", wordmarkClassName)}>TradeTies</span>
    </span>
  );
}
