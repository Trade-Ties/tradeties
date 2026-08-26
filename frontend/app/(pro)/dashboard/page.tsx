import Link from "next/link";

import { STEPS, resumeStepIndex } from "@/components/profile/wizardSteps";
import { WIZARD_PATH } from "@/lib/routes";
import { PROFILE_URL_PREFIX } from "@/components/profile/slug";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { fetchMyBusiness, type BusinessProfile } from "@/lib/api/business";
import type { ApiResult } from "@/lib/api/problem";
import { portalSession, portalToken } from "@/lib/portal/session";

export default async function DashboardPage() {
  // Side by side rather than one behind the other — see `portalToken`.
  const token = await portalToken();
  const [{ user }, business] = await Promise.all([portalSession(), fetchMyBusiness(token)]);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">
        Welcome{user.firstName ? `, ${user.firstName}` : ""}
      </h1>
      <p className="mt-3 text-muted-foreground">
        Your business account is active. This is where your calendar and incoming requests
        will live.
      </p>

      <div className="mt-10">
        <ProfileCard business={business} />
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

function ProfileCard({ business }: { business: ApiResult<BusinessProfile | null> }) {
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
