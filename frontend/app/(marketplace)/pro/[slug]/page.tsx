import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";

import { SiteHeader } from "@/components/marketing/SiteHeader";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { BusinessProfile } from "@/components/marketing/BusinessProfile";
import { getBusiness } from "@/lib/api/marketplace";

/**
 * A business's public page, at the address the contract freezes at the first publish:
 * `/pro/{slug}`.
 *
 * <p>Read on the server and without a token, like the search. Nothing on it depends on who is
 * looking, which is the property that lets it stay cacheable and the reason a signed-in
 * tradesperson sees exactly what a stranger sees.
 */
export default async function ProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await getBusiness(slug);

  if (!result.ok) {
    return (
      <>
        <SiteHeader />
        <Unreachable />
        <SiteFooter />
      </>
    );
  }

  // A slug nobody holds, a draft and a suspension are one answer from the backend, and they stay
  // one answer here. Telling them apart would publish a moderation decision to anybody who can
  // type a URL — and to this page they are the same fact anyway: there is nothing to show.
  if (result.data === null) {
    notFound();
  }

  return (
    <>
      <SiteHeader />
      <BusinessProfile profile={result.data} />
      <SiteFooter />
    </>
  );
}

/**
 * The title is what a shared link shows, so it names the business rather than the site.
 *
 * The profile is fetched a second time here, which the request cache collapses into the one call
 * the page itself makes.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const result = await getBusiness(slug);

  if (!result.ok || result.data === null) {
    return { title: "TradeTies" };
  }

  return {
    title: `${result.data.displayName} — ${result.data.city}, ${result.data.state} | TradeTies`,
    description: result.data.description ?? undefined,
  };
}

/**
 * Separate from the not-found page on purpose. "This business does not exist" and "we could not
 * reach TradeTies" send somebody to two different places, and only one of them is worth retrying.
 */
function Unreachable() {
  return (
    <section className="pb-20 pt-8">
      <div className="mx-auto max-w-[540px] px-6 py-16 text-center">
        <h1 className="text-[26px] font-semibold tracking-tight text-brand">
          We could not load that profile.
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted-ink">
          That is on us, not on the address you typed. Trying again usually works.
        </p>
        <Link
          href="/"
          className="mt-7 inline-block rounded-2xl bg-brand px-6 py-3 text-[15px] font-semibold text-white"
        >
          Start a new search
        </Link>
      </div>
    </section>
  );
}
