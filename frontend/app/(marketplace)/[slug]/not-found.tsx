import Link from "next/link";

import { SiteHeader } from "@/components/marketing/SiteHeader";
import { SiteFooter } from "@/components/marketing/SiteFooter";

/**
 * What a profile address nobody answers to looks like.
 *
 * <p>Worded for the three cases it covers at once — a typo, a business that has taken its profile
 * back to draft, and one the marketplace has switched off — because the backend deliberately does
 * not say which, and a page that guessed would be guessing out loud.
 */
export default function ProfileNotFound() {
  return (
    <>
      <SiteHeader />
      <section className="pb-20 pt-8">
        <div className="mx-auto max-w-[540px] px-6 py-16 text-center">
          <h1 className="text-[26px] font-semibold tracking-tight text-brand">
            No business at that address.
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-muted-ink">
            The link may be mistyped, or the business may not be listed right now. Searching your
            ZIP code finds everyone who travels to you.
          </p>
          <Link
            href="/"
            className="mt-7 inline-block rounded-2xl bg-brand px-6 py-3 text-[15px] font-semibold text-white"
          >
            Start a new search
          </Link>
        </div>
      </section>
      <SiteFooter />
    </>
  );
}
