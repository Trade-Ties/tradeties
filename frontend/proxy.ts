import { authkitProxy } from "@workos-inc/authkit-nextjs";

/**
 * Keeps the AuthKit session alive, hands it to server components, and performs the
 * redirect to sign-in.
 *
 * Next.js 16 renamed `middleware.ts` to `proxy.ts`; `authkitProxy` is the matching export.
 *
 * **Why the redirect happens here and not in the dashboard layout.** Starting a sign-in
 * writes a PKCE cookie, and Next.js only permits cookie writes from a proxy, a route
 * handler or a server action — never while rendering a server component. A layout that
 * tried to redirect an anonymous visitor would therefore throw instead of redirecting. The
 * proxy is one of the places allowed to do it, so authentication is gated here.
 *
 * Authorization stays in `app/(pro)/dashboard/layout.tsx`, which asks our own backend
 * whether the signed-in person actually holds a business role. That is a pure read, so it
 * belongs where the data is used. Split by capability, not by taste:
 * *authenticated* here, *allowed* there.
 *
 * **The matcher is load-bearing.** `withAuth()` reads the session from a header this proxy
 * sets, not from the cookie directly. A route calling `withAuth` without being matched here
 * sees no session at all. Any new route on the tradesperson side must be added below.
 *
 * **Scoped to `(pro)` on purpose.** Matching everything except static assets would drag the
 * public marketplace into AuthKit. Verified rather than assumed: with a broad matcher and
 * WorkOS credentials missing, `GET /` answers 500. Customers need no account, so their side
 * must not depend on the identity provider being configured or reachable — a WorkOS outage
 * should cost sign-ins, not the search page.
 *
 * `/portal` is matched but exempt: it must render for anonymous visitors, yet it reads the
 * session to send an already-signed-in tradesperson straight to their dashboard.
 *
 * Unmatched on purpose: `/callback`, where `handleAuth` establishes the session itself, and
 * `/portal/sign-in` and `/portal/sign-up`, which are route handlers that start the flow.
 */
export default authkitProxy({
  middlewareAuth: {
    enabled: true,
    unauthenticatedPaths: ["/portal"],
  },
});

export const config = {
  matcher: ["/portal", "/dashboard/:path*"],
};