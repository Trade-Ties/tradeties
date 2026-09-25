import { NextResponse } from "next/server";

import { suggestServices } from "@/lib/api/marketplace";

/**
 * The typeahead's way to the backend, and the only reason it exists is addressing.
 *
 * `API_BASE_URL` is the backend as seen from the Next server — `localhost:8080` in development,
 * an internal name in a deployment. A browser cannot reach it, and every other read in this app
 * happens in a server component where that does not matter. This one happens while somebody is
 * typing, so it needs a same-origin URL, and a route handler is the smallest thing that is one.
 *
 * A route handler rather than a server action, although both would run on the server. Actions are
 * POSTs that Next queues one behind another, which is the wrong shape for a request fired on every
 * few keystrokes; this is a GET that the browser can run in parallel and cancel.
 *
 * **A failure answers an empty list, not an error.** Nothing here is the customer's doing: they
 * are typing, and a dropdown that reports a backend problem interrupts a sentence they were in
 * the middle of. The failure is already logged by `attempt` on the way past, which is where
 * anybody who needs to know about it will look. The search itself still answers properly when
 * they submit — including telling them if the postal code is one the Census does not list, which
 * is the one message worth putting in front of them.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const typed = params.get("q") ?? "";
  const zip = params.get("zip");

  if (!typed.trim()) {
    return NextResponse.json([]);
  }

  const suggestions = await suggestServices(typed, zip?.length === 5 ? zip : null);

  return NextResponse.json(suggestions.ok ? suggestions.data : []);
}
