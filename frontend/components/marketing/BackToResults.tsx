"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * The way back from a business's page to the results it was found in.
 *
 * The results page writes its own address down when it is shown, and this reads it — rather than
 * the address travelling along in every link, which the profile's service picker, month arrows and
 * booking page would each have to remember to carry. Per tab, like the browser's own history, and
 * gone with it. A page opened from anywhere else, or in a fresh tab, goes back to the start.
 */
const KEY = "tt_last_results";

/** Called by the results page, in the browser. */
export function rememberResults() {
  try {
    sessionStorage.setItem(KEY, window.location.pathname + window.location.search);
  } catch {
    // Storage refused (a private window, say): the link falls back to the start, which still works.
  }
}

function readResults(): string | null {
  try {
    const stored = sessionStorage.getItem(KEY);
    // Only ever a results page of this site, whatever else ends up in storage.
    return stored?.startsWith("/browse?") ? stored : null;
  } catch {
    return null;
  }
}

const noSubscription = () => () => {};

export function BackToResults({ className }: { className?: string }) {
  // Nothing on the server, which has no storage; the browser fills it in on hydration.
  const results = useSyncExternalStore(noSubscription, readResults, () => null);

  return (
    <Link href={results ?? "/"} className={className}>
      <ArrowLeft className="size-4" />
      {results ? "Back to results" : "Back to search"}
    </Link>
  );
}
