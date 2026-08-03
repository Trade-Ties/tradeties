import Link from "next/link";

import { isTradesperson } from "@/lib/api/identity";
import { portalSession } from "@/lib/portal/session";

import { retryRegistration, signOutFromPortal } from "./actions";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, marketplaceUser } = await portalSession();

  if (!isTradesperson(marketplaceUser)) {
    return <RegistrationIncomplete email={user.email} />;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-baseline gap-3">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              TradeTies
            </Link>
            <span className="text-sm text-muted-foreground">Portal</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-muted-foreground sm:inline">{user.email}</span>
            <form action={signOutFromPortal}>
              <button
                type="submit"
                className="rounded-md border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>
    </div>
  );
}

/**
 * Signed in without a business role because registration failed or the token was rejected.
 * Offer a way out instead of an empty dashboard; keep the user-facing message cause-neutral.
 */
function RegistrationIncomplete({ email }: { email: string | null }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-semibold tracking-tight">Finish setting up your account</h1>

        <p className="mt-3 text-muted-foreground">
          You are signed in as {email ?? "your account"}, but your business account has not been
          created yet.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <form action={retryRegistration}>
            <button
              type="submit"
              className="h-12 w-full rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Try again
            </button>
          </form>

          <form action={signOutFromPortal}>
            <button
              type="submit"
              className="h-12 w-full rounded-lg border border-border px-6 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}