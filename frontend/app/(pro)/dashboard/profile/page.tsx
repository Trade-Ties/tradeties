import Link from "next/link";
import { Building2 } from "lucide-react";

import ProfileWizard from "@/components/profile/ProfileWizard";
import { isFocusTarget, type FocusTargetName } from "@/components/profile/focusTarget";
import { restore } from "@/components/profile/fromWire";
import { PROFILE_URL_PREFIX } from "@/components/profile/slug";
import { STEPS, resumeAt, type Resume } from "@/components/profile/wizardSteps";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchMyBusiness, fetchMyReadiness, fetchTimeZones, type BusinessProfile } from "@/lib/api/business";
import { loadOnboarding, type OnboardingLoad } from "@/lib/api/onboarding";
import type { ApiResult } from "@/lib/api/problem";
import { portalToken } from "@/lib/portal/session";
import { DASHBOARD_PATH, WIZARD_PARAM, WIZARD_PATH, WIZARD_SECTION_PARAM } from "@/lib/routes";

export default async function BusinessProfilePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  // Presence first: a link hand-trimmed to `?edit` means the same as the full `WIZARD_PATH`.
  const editing = params[WIZARD_PARAM] !== undefined;

  return editing ? <WizardScreen openAt={requestedOpening(params)} /> : <Overview />;
}

/** Where a link asked the wizard to open, as `wizardPathAt` writes it. */
interface Opening {
  step: number;
  focus: FocusTargetName | null;
}

/**
 * A step the link names, and a section of it; null when it names none, which is every
 * `WIZARD_PATH` link. Anything that is not a step or a section is read as not given rather than
 * refused — a stale or hand-edited link still opens the wizard.
 */
function requestedOpening(params: Record<string, string | string[] | undefined>): Opening | null {
  const step = STEPS.findIndex((s) => s.key === params[WIZARD_PARAM]);
  if (step < 0) return null;

  const section = params[WIZARD_SECTION_PARAM];
  return { step, focus: typeof section === "string" && isFocusTarget(section) ? section : null };
}

async function Overview() {
  const token = await portalToken();
  const [business, timeZones] = await Promise.all([fetchMyBusiness(token), fetchTimeZones(token)]);
  const resume = await resumeFor(business, token);

  return (
    <div className="mx-auto w-full max-w-5xl px-8 py-10">
      <h1 className="mb-1 text-3xl font-bold tracking-[-0.02em] text-brand">Business profile</h1>
      <p className="mb-8 text-muted-ink">What customers see when they find you.</p>

      <div className="flex flex-col gap-4">
        <StatusCard business={business} resume={resume} />
        {business.ok && business.data !== null && (
          <Details
            profile={business.data}
            // "Eastern Time" rather than the id it is stored as; the id is still better than nothing.
            timeZone={
              (timeZones.ok && timeZones.data?.find((z) => z.code === business.data!.timeZone)?.displayName) ||
              business.data.timeZone
            }
          />
        )}
      </div>
    </div>
  );
}

/**
 * Where "Continue" will reopen the wizard, worked out the way the wizard itself works it out so
 * the step the card names is the step that opens. Only for a draft that has never been live —
 * the one card that names a step. A checklist that cannot be read is not worth failing the page
 * over: the counter alone still gives an answer.
 */
async function resumeFor(
  business: ApiResult<BusinessProfile | null>,
  token: string
): Promise<Resume | null> {
  if (!business.ok || business.data === null) return null;

  const profile = business.data;
  if (profile.status !== "DRAFT" || profile.slugLocked) return null;

  const readiness = await fetchMyReadiness(token);

  return resumeAt(profile.onboardingCompletedStep, readiness.ok ? readiness.data : null);
}

async function WizardScreen({ openAt }: { openAt: Opening | null }) {
  const load = await loadOnboarding(await portalToken());

  if (load.state === "unavailable") {
    return <ProfileUnavailable />;
  }

  return (
    // No height of its own: the wizard runs as long as its step and the page scrolls.
    <div className="w-full px-8">
      {load.state === "not-started" ? (
        <ProfileWizard reference={load.reference} />
      ) : (
        <ResumedWizard load={load} openAt={openAt} />
      )}
    </div>
  );
}

/**
 * Only a profile that exists can be opened part-way: before one does, every later step is held
 * behind the Business step, so a link naming one opens at the start like any other.
 */
function ResumedWizard({
  load,
  openAt,
}: {
  load: Extract<OnboardingLoad, { state: "resumable" }>;
  openAt: Opening | null;
}) {
  const { snapshot } = load;
  const resume =
    openAt !== null
      ? { index: openAt.step, focus: openAt.focus }
      : resumeAt(snapshot.profile.onboardingCompletedStep, snapshot.readiness);

  return (
    <ProfileWizard
      reference={load.reference}
      initial={restore(snapshot)}
      initialStep={resume.index}
      initialFocus={resume.focus}
      // The server's own checklist, so the publish step opens on the real conditions.
      initialReadiness={snapshot.readiness}
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
    <div className="w-full max-w-5xl px-8 py-10">
      <h1 className="text-3xl font-bold tracking-[-0.02em] text-brand">Your profile could not be loaded</h1>

      <p className="mt-4 max-w-prose text-muted-ink">
        Nothing has been changed. Try again in a moment — if it keeps happening, your saved
        profile is still safe and we will pick it up where you left off.
      </p>

      <div className="mt-8 flex gap-3">
        <a href={WIZARD_PATH} className={buttonVariants({ variant: "default", size: "lg" }) + " rounded-full"}>
          Try again
        </a>
        <Link
          href={DASHBOARD_PATH}
          className={buttonVariants({ variant: "outline", size: "lg" }) + " rounded-full border-line"}
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

function copyFor(business: ApiResult<BusinessProfile | null>, resume: Resume | null): CardCopy {
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
      emphasis: "default",
    };
  }

  // Named as well as numbered: after a jump back, "step 1 of 6" alone reads as starting over.
  const next = STEPS[resume?.index ?? 0];

  return {
    title: "Finish your business profile",
    description: `Next: ${next.title} (step ${(resume?.index ?? 0) + 1} of ${STEPS.length}). Until it is published, your profile shows nothing.`,
    action: "Continue",
    emphasis: "default",
  };
}

function StatusCard({
  business,
  resume,
}: {
  business: ApiResult<BusinessProfile | null>;
  resume: Resume | null;
}) {
  const { title, description, action, emphasis } = copyFor(business, resume);
  // Mirrors the amber "needs setup" language on the dashboard overview — same underlying
  // condition, so it should look the same wherever it shows up.
  const needsAttention = emphasis === "default";

  return (
    <Card
      className={
        needsAttention
          ? "gap-0 rounded-3xl border border-amber-500/30 bg-amber-500/5 py-0 shadow-card"
          : "gap-0 rounded-3xl border border-line bg-white py-0 shadow-card"
      }
    >
      <CardContent className="flex flex-col items-start justify-between gap-4 px-6 py-6 sm:flex-row sm:items-center">
        <div>
          <p className={needsAttention ? "text-xl font-bold text-amber-900" : "text-xl font-bold text-brand"}>
            {title}
          </p>
          <p className={needsAttention ? "mt-1 max-w-md text-sm text-amber-800" : "mt-1 max-w-md text-sm text-muted-ink"}>
            {description}
          </p>
        </div>
        <Link
          href={WIZARD_PATH}
          className={
            buttonVariants({ variant: emphasis, size: "lg" }) +
            (emphasis === "default" ? " shrink-0 rounded-full" : " shrink-0 rounded-full border-line")
          }
        >
          {action}
        </Link>
      </CardContent>
    </Card>
  );
}

type BadgeLook = { label: string; className: string };

const STATUS_BADGE: Record<BusinessProfile["status"], BadgeLook> = {
  PUBLISHED: { label: "Published", className: "bg-go-bg text-[#07734F]" },
  DRAFT: { label: "Draft", className: "bg-amber-500/15 text-amber-700" },
  SUSPENDED: { label: "Suspended", className: "bg-destructive/10 text-destructive" },
};

function Details({ profile, timeZone }: { profile: BusinessProfile; timeZone: string }) {
  const status = STATUS_BADGE[profile.status];
  const { address } = profile;

  return (
    <Card className="gap-4 rounded-3xl border border-line bg-white py-0 shadow-card">
      <CardHeader className="px-5 pt-5">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Building2 className="size-4 text-brand-500" />
          Business details
        </CardTitle>
        <CardDescription className="text-muted-ink">What customers see on your public page.</CardDescription>
      </CardHeader>

      <CardContent className="px-5 pb-5">
        <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-[12rem_1fr]">
          <Row label="Status">
            <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${status.className}`}>
              {status.label}
            </span>
          </Row>
          <Row label="Public profile URL">
            {profile.slugLocked || profile.status === "PUBLISHED"
              ? `${PROFILE_URL_PREFIX}${profile.slug}`
              : `${PROFILE_URL_PREFIX}${profile.slug} — not taken until you publish`}
          </Row>
          <Row label="Business name shown">{profile.displayName}</Row>
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
          <Row label="Time zone">{timeZone}</Row>
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
      <dt className="text-sm text-muted-ink">{label}</dt>
      <dd className={empty ? "text-sm text-faint" : "text-sm font-medium"}>{empty ? "Not given" : children}</dd>
    </>
  );
}
