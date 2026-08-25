import { redirect } from "next/navigation";

import ProfileWizard from "@/components/profile/ProfileWizard";
import { WIZARD_PATH, resumeStepIndex } from "@/components/profile/constants";
import { restore } from "@/components/profile/fromWire";
import { buttonVariants } from "@/components/ui/button";
import { isTradesperson } from "@/lib/api/identity";
import { loadOnboarding } from "@/lib/api/onboarding";
import { portalSession, portalToken } from "@/lib/portal/session";
import { cn } from "@/lib/utils";

/**
 * Must stay on a path the proxy matches. `withAuth()` reads the session from a header the proxy
 * sets, so a route outside the matcher sees no session at all: the page would render for anyone
 * and every backend call would go out unauthenticated.
 */
export default async function CreateProfilePage() {
  // Fanned out before the role check rather than behind it — see `portalToken`. A caller without
  // the role pays for reads it then redirects away from, which is the rare path.
  const token = await portalToken();
  const [{ marketplaceUser }, load] = await Promise.all([
    portalSession(),
    loadOnboarding(token),
  ]);

  if (!isTradesperson(marketplaceUser)) {
    redirect("/dashboard");
  }

  if (load.state === "unavailable") {
    return <ProfileUnavailable />;
  }

  if (load.state === "not-started") {
    return <ProfileWizard reference={load.reference} />;
  }

  // A pure translation of what was just read, so it happens here rather than in the browser.
  return (
    <ProfileWizard
      reference={load.reference}
      initial={restore(load.snapshot)}
      initialStep={resumeStepIndex(load.snapshot.profile.onboardingCompletedStep)}
      // The server's own checklist, so the publish step opens on the real conditions.
      initialReadiness={load.snapshot.readiness}
    />
  );
}

/**
 * Shown when the stored profile could not be read. An empty wizard would be the damaging
 * option: a tradesperson who already has a business would fill step 1 again and be told on save
 * that they may only have one.
 */
function ProfileUnavailable() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-semibold tracking-tight">Your profile could not be loaded</h1>

        <p className="mt-3 text-muted-foreground">
          Nothing has been changed. Try again in a moment — if it keeps happening, your saved
          profile is still safe and we will pick it up where you left off.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          {/* A full request, not a client navigation: the point is to read the profile again. */}
          <a
            href={WIZARD_PATH}
            className={cn(buttonVariants({ variant: "default", size: "lg" }), "h-12 w-full")}
          >
            Try again
          </a>
          <a
            href="/dashboard"
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-12 w-full")}
          >
            Back to dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
