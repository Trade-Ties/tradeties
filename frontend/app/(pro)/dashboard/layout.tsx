import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { isTradesperson } from "@/lib/api/identity";
import { portalSession } from "@/lib/portal/session";

import { retryRegistration, signOutFromPortal } from "./actions";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, marketplaceUser } = await portalSession();

  if (!isTradesperson(marketplaceUser)) {
    return <RegistrationIncomplete email={user.email} />;
  }

  return (
    <SidebarProvider
      style={
        { "--sidebar-width-icon": "3.5rem", "--portal-header": "3.25rem" } as React.CSSProperties
      }
    >
      <AppSidebar user={user} />

      <SidebarInset>
        {/* On mobile the sidebar is a sheet, and this trigger is the only way to open it. */}
        <header className="flex h-(--portal-header) items-center border-b border-border px-4">
          <SidebarTrigger />
        </header>

        <div className="flex-1">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}

/**
 * Rendered when the session carries no business role — registration failed, or the token was
 * rejected. The two are indistinguishable here, so the message names no cause.
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
