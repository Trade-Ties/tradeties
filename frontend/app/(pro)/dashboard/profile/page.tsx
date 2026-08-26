import Link from "next/link";

import ProfileWizard from "@/components/profile/ProfileWizard";
import { restore } from "@/components/profile/fromWire";
import { PROFILE_URL_PREFIX } from "@/components/profile/slug";
import { STEPS, resumeStepIndex } from "@/components/profile/wizardSteps";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { fetchMyBusiness, type BusinessProfile } from "@/lib/api/business";
import { loadOnboarding } from "@/lib/api/onboarding";
import type { ApiResult } from "@/lib/api/problem";
import { portalToken } from "@/lib/portal/session";
import { DASHBOARD_PATH, WIZARD_PARAM, WIZARD_PATH } from "@/lib/routes";

export default async function BusinessProfilePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Presence, not value: a link hand-trimmed to `?edit` means the same as the full `WIZARD_PATH`.
  const editing = (await searchParams)[WIZARD_PARAM] !== undefined;

  return editing ? <WizardScreen /> : <Overview />;
}

async function Overview() {
  const business = await fetchMyBusiness(await portalToken());

  return (
    <div className="mx-auto w-full max-w-5xl px-8 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Business profile</h1>

      <div className="mt-10 flex flex-col gap-6">
        <StatusCard business={business} />
        {business.ok && business.data !== null && <Details profile={business.data} />}
      </div>
    </div>
  );
}

async function WizardScreen() {
  const load = await loadOnboarding(await portalToken());

  if (load.state === "unavailable") {
    return <ProfileUnavailable />;
  }

  return (
    <div className="h-[calc(100dvh-var(--portal-header))] w-full px-8 py-10">
      {load.state === "not-started" ? (
        <ProfileWizard reference={load.reference} />
      ) : (
        <ProfileWizard
          reference={load.reference}
          initial={restore(load.snapshot)}
          initialStep={resumeStepIndex(load.snapshot.profile.onboardingCompletedStep)}
          // The server's own checklist, so the publish step opens on the real conditions.
          initialReadiness={load.snapshot.readiness}
        />
      )}
    </div>
  );
}

/**
 * Shown when the stored profile could not be read. An empty wizard would be the damaging
 * option: a tradesperson who already has a business would fill step 1 again and be told on save
 * that they may only have one.
 */
function ProfileUnavailable() {
  return (
    <div className="w-full max-w-5xl px-8 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Your profile could not be loaded</h1>

      <p className="mt-4 max-w-prose text-muted-foreground">
        Nothing has been changed. Try again in a moment — if it keeps happening, your saved
        profile is still safe and we will pick it up where you left off.
      </p>

      <div className="mt-8 flex gap-3">
        <a href={WIZARD_PATH} className={buttonVariants({ variant: "default", size: "lg" })}>
          Try again
        </a>
        <Link
          href={DASHBOARD_PATH}
          className={buttonVariants({ variant: "outline", size: "lg" })}
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}

interface CardCopy {
  title: string;
  description: string;
  action: string;
  emphasis: "default" | "outline";
}

function copyFor(business: ApiResult<BusinessProfile | null>): CardCopy {
  if (!business.ok) {
    return {
      title: "Your business profile",
      description:
        "We could not check the status of your profile just now. Opening it will try again.",
      action: "Open profile setup",
      emphasis: "outline",
    };
  }

  const profile = business.data;

  if (profile === null) {
    return {
      title: "Set up your profile",
      description:
        "Customers cannot find you until your profile is published. You can leave at any point and pick it up where you stopped.",
      action: "Get started",
      emphasis: "default",
    };
  }

  const publicUrl = `${PROFILE_URL_PREFIX}${profile.slug}`;

  if (profile.status === "PUBLISHED") {
    return {
      title: "Your profile is live",
      description: `Customers can find and book you at ${publicUrl}.`,
      action: "Edit profile",
      emphasis: "outline",
    };
  }

  if (profile.status === "SUSPENDED") {
    return {
      title: "Your profile is suspended",
      description:
        "It is not visible to customers, and putting it back online is not something this screen can do. Your details can still be edited.",
      action: "Edit profile",
      emphasis: "outline",
    };
  }

  // `status` alone cannot tell a draft that has been live before from one that never has —
  // unpublishing puts a profile that ran for a year back to DRAFT. `slugLocked` separates them.
  if (profile.slugLocked) {
    return {
      title: "Your profile is offline",
      description: `It is not visible to customers just now. Publishing it again puts it back at ${publicUrl}, the address it already had.`,
      action: "Edit profile",
      emphasis: "outline",
    };
  }

  const nextIndex = resumeStepIndex(profile.onboardingCompletedStep);

  return {
    title: "Finish your business profile",
    description: `Step ${nextIndex + 1} of ${STEPS.length} - Until it is published, your profile shows nothing.`,
    action: "Continue",
    emphasis: "default",
  };
}

function StatusCard({ business }: { business: ApiResult<BusinessProfile | null> }) {
  const { title, description, action, emphasis } = copyFor(business);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardFooter>
        <Link href={WIZARD_PATH} className={buttonVariants({ variant: emphasis, size: "lg" })}>
          {action}
        </Link>
      </CardFooter>
    </Card>
  );
}

type BadgeLook = {
  label: string;
  variant: "default" | "outline" | "destructive";
  className?: string;
};

const STATUS_BADGE: Record<BusinessProfile["status"], BadgeLook> = {
  PUBLISHED: {
    label: "Published",
    variant: "default",
    className:
      "bg-emerald-600/10 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
  },
  DRAFT: {
    label: "Draft",
    variant: "outline",
    className:
      "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:border-amber-400/40 dark:bg-amber-400/15 dark:text-amber-300",
  },
  SUSPENDED: { label: "Suspended", variant: "destructive" },
};

function Details({ profile }: { profile: BusinessProfile }) {
  const status = STATUS_BADGE[profile.status];
  const { address } = profile;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Business details</CardTitle>
        <CardDescription>What customers see on your public page.</CardDescription>
      </CardHeader>

      <CardContent>
        <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-[12rem_1fr]">
          <Row label="Status">
            <Badge variant={status.variant} className={status.className}>
              {status.label}
            </Badge>
          </Row>
          <Row label="Public address">
            {profile.slugLocked || profile.status === "PUBLISHED"
              ? `${PROFILE_URL_PREFIX}${profile.slug}`
              : `${PROFILE_URL_PREFIX}${profile.slug} — not taken until you publish`}
          </Row>
          <Row label="Shown to customers">{profile.displayName}</Row>
          <Row label="Registered name">{profile.legalName}</Row>
          <Row label="About">{profile.description}</Row>
          <Row label="Phone">{profile.phone}</Row>
          <Row label="Email">{profile.email}</Row>
          <Row label="Website">{profile.websiteUrl}</Row>
          <Row label="Address">
            {[address.street1, address.street2, `${address.city}, ${address.state} ${address.postalCode}`]
              .filter(Boolean)
              .join(" · ")}
          </Row>
          <Row label="Time zone">{profile.timeZone}</Row>
          <Row label="Service radius">{`${profile.serviceRadiusMiles} miles`}</Row>
        </dl>
      </CardContent>
    </Card>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  const empty = children === null || children === undefined || children === "";

  return (
    <>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={empty ? "text-sm text-muted-foreground/60" : "text-sm"}>
        {empty ? "Not given" : children}
      </dd>
    </>
  );
}
