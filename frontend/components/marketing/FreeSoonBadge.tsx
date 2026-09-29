import { connection } from "next/server";

import { Badge } from "@/components/ui/badge";
import { getMarketplaceSummary } from "@/lib/api/marketplace";
import { cn } from "@/lib/utils";

const BADGE_CLASS =
  "animate-tt-rise mb-[22px] h-auto gap-2 rounded-full border-transparent bg-go-bg py-1.5 pl-2.5 pr-3.5 text-[13px] font-semibold text-[#07734F] [animation-delay:40ms]";

/**
 * How many tradespeople can be booked soon, across the whole marketplace.
 *
 * Not "near you": the landing page does not know where the visitor is, and the count is the same
 * for everybody. Not "today" either: most businesses require a day's notice. Renders nothing at
 * zero or when the backend cannot be reached — "0 free" is a worse headline than none.
 */
export async function FreeSoonBadge() {
  // Otherwise the build prerenders the page once and the count is frozen at build time.
  await connection();

  const summary = await getMarketplaceSummary();
  if (!summary.ok || summary.data.freeWithinWindow === 0) {
    return null;
  }

  const { freeWithinWindow: count, windowHours } = summary.data;

  return (
    <Badge className={BADGE_CLASS}>
      <span className="animate-tt-pulse size-[7px] rounded-full bg-go" />
      {count} {count === 1 ? "tradesperson" : "tradespeople"} free in the next {windowHours} hours
    </Badge>
  );
}

/** Holds the badge's space while the count loads, so the headline below does not jump. */
export function FreeSoonBadgeFallback() {
  return (
    <Badge aria-hidden="true" className={cn(BADGE_CLASS, "invisible")}>
      <span className="size-[7px]" />
      tradespeople free in the next hours
    </Badge>
  );
}
