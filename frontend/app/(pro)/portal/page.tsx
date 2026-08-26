import Link from "next/link";
import { redirect } from "next/navigation";

import { withAuth } from "@workos-inc/authkit-nextjs";

import {
  DASHBOARD_PATH,
  MARKETPLACE_PATH,
  PORTAL_SIGN_IN_PATH,
  PORTAL_SIGN_UP_PATH,
} from "@/lib/routes";

/**
 * Stable tradesperson entry point and future PWA start URL.
 * Redirects existing sessions to the dashboard; authentication uses route handlers so they can set the PKCE cookie.
 */
export default async function PortalPage() {
  const { user } = await withAuth();

  if (user) {
    redirect(DASHBOARD_PATH);
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <Link href={MARKETPLACE_PATH} className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to TradeTies
        </Link>

        <h1 className="mt-8 text-3xl font-semibold tracking-tight">Tradesperson portal</h1>
        <p className="mt-3 text-muted-foreground">
          Manage your profile, your calendar and the requests customers send you.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <a
            href={PORTAL_SIGN_UP_PATH}
            className="flex h-12 items-center justify-center rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Create a business account
          </a>
          <a
            href={PORTAL_SIGN_IN_PATH}
            className="flex h-12 items-center justify-center rounded-lg border border-border px-6 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            Sign in
          </a>
        </div>

        <p className="mt-8 text-sm text-muted-foreground">
          Looking to hire instead?{" "}
          <Link href={MARKETPLACE_PATH} className="underline underline-offset-4 hover:text-foreground">
            Search tradespeople
          </Link>{" "}
          — no account required.
        </p>
      </div>
    </div>
  );
}