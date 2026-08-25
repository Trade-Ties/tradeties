import { authkitProxy } from "@workos-inc/authkit-nextjs";

/**
 * Keeps the AuthKit session alive, hands it to server components, and performs the redirect to
 * sign-in.
 *
 * Next.js 16 renamed `middleware.ts` to `proxy.ts`; `authkitProxy` is the matching export.
 *
 * The redirect happens here rather than in the dashboard layout because starting a sign-in
 * writes a PKCE cookie, and Next.js permits cookie writes only from a proxy, a route handler or
 * a server action — a layout that tried it would throw instead of redirecting.
 *
 * Authorization stays in `app/(pro)/dashboard/layout.tsx` and `app/(pro)/profile/create`, which
 * ask the backend whether the signed-in person holds a business role: authenticated here,
 * allowed there.
 *
 * The matcher is load-bearing. `withAuth()` reads the session from a header this proxy sets,
 * not from the cookie, so a route calling `withAuth` without being matched below sees no
 * session at all. Any new route on the tradesperson side must be added there. The server
 * actions a page posts to are covered by the page's own entry, because an action is delivered
 * to the path of the page that rendered it.
 *
 * Scoped to `(pro)` on purpose: matching everything except static assets drags the public
 * marketplace into AuthKit, and with WorkOS credentials missing `GET /` then answers 500.
 * Customers need no account, so a WorkOS outage must cost sign-ins rather than the search page.
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
  matcher: ["/portal", "/dashboard/:path*", "/profile/:path*"],
};