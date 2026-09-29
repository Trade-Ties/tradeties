import Link from "next/link";

import { SiteFooter } from "@/components/marketing/SiteFooter";
import { SiteHeader } from "@/components/marketing/SiteHeader";

/**
 * A link that opens nothing — mistyped, cut short by an email client, or expired. The API does
 * not say which, on purpose, so this page names all three rather than guessing.
 */
export default function RequestNotFound() {
  return (
    <>
      <SiteHeader />
      <section className="pb-20 pt-8">
        <div className="mx-auto max-w-[560px] px-6 py-16 text-center">
          <h1 className="text-[26px] font-semibold tracking-tight text-brand">
            This link doesn&apos;t open a request.
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-muted-ink">
            It may have been copied only partly, or it may have expired — links work for three months
            after a request is sent. Your confirmation email has the full link.
          </p>
          <Link
            href="/"
            className="mt-7 inline-block rounded-2xl bg-brand px-6 py-3 text-[15px] font-semibold text-white"
          >
            Find a tradesperson
          </Link>
        </div>
      </section>
      <SiteFooter />
    </>
  );
}
