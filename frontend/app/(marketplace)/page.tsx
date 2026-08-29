import Link from "next/link";

import { SiteHeader } from "@/components/marketing/SiteHeader";
import { HeroSearch } from "@/components/marketing/HeroSearch";
import { AvailabilityRail } from "@/components/marketing/AvailabilityRail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const STEPS = [
  {
    title: "Describe the problem",
    body: "Tell us what's wrong in a few words, and we'll match you with the right professional.",
    icon: (
      <path d="M4 5h12M4 10h12M4 15h7" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" />
    ),
  },
  {
    title: "Pick a time",
    body: "See real available slots from local tradespeople and choose your slot.",
    icon: (
      <>
        <rect x="3" y="4.5" width="14" height="12.5" rx="2.4" stroke="#fff" strokeWidth="1.8" />
        <path d="M3 8.5h14M7 3v3M13 3v3" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
      </>
    ),
  },
  {
    title: "You're booked",
    body: "Your appointment is confirmed. See the agreed rate and fees before the job begins.",
    icon: (
      <path d="M3 10.5l4.2 4.2L17 5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
];

const PROMISES = [
  {
    title: "Verified professionals",
    body: "Every license is checked against state records, with the trade and expiration date shown on the profile.",
    icon: (
      <>
        <path d="M10 2.5l6 2.4v4.6c0 3.6-2.5 6.9-6 8-3.5-1.1-6-4.4-6-8V4.9l6-2.4z" stroke="#001C3D" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="M7.4 10.2l1.9 1.9 3.5-3.7" stroke="#001C3D" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  {
    title: "Know the price upfront",
    body: "Avoid hidden costs. Hourly rates, minimum billing, call-out fee and materials markups are shown before you book.",
    icon: (
      <path d="M10 3v14M13.2 6.3c-.6-.9-1.8-1.4-3.2-1.4-1.9 0-3.2 1-3.2 2.4 0 3.3 6.8 1.9 6.8 5.3 0 1.5-1.4 2.5-3.6 2.5-1.6 0-2.9-.6-3.5-1.6" stroke="#001C3D" strokeWidth="1.7" strokeLinecap="round" />
    ),
  },
  {
    title: "Real availability",
    body: "Professionals set their own working hours, so the slots you see are the ones they have available to book.",
    icon: (
      <>
        <circle cx="10" cy="10" r="7.2" stroke="#001C3D" strokeWidth="1.7" />
        <path d="M10 5.8V10l2.8 1.8" stroke="#001C3D" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
];

export default function MarketplaceLandingPage() {
  return (
    <>
      <SiteHeader />

      {/* Hero */}
      <section className="hero-wash overflow-hidden pb-16 pt-[84px]">
        <div className="mx-auto max-w-[1180px] px-6">
          <Badge className="animate-tt-rise mb-[22px] h-auto gap-2 rounded-full border-transparent bg-go-bg py-1.5 pl-2.5 pr-3.5 text-[13px] font-semibold text-[#07734F] [animation-delay:40ms]">
            <span className="animate-tt-pulse size-[7px] rounded-full bg-go" />
            412 tradespeople free today near you
          </Badge>

          <h1 className="animate-tt-rise mb-5 max-w-[15ch] text-[clamp(40px,6.4vw,72px)] font-extrabold leading-[1.03] tracking-[-0.038em] [animation-delay:40ms]">
            Broken now.
            <br />
            <span className="text-brand-500">Fixed today.</span>
          </h1>

          <p className="animate-tt-rise mb-9 max-w-[54ch] text-[clamp(16.5px,1.9vw,19.5px)] leading-relaxed text-muted-ink [animation-delay:120ms]">
            Book an available plumber, electrician, carpenter or HVAC professional near you —
            without waiting for callbacks.
          </p>

          <HeroSearch />
        </div>
      </section>

      {/* Availability rail */}
      <AvailabilityRail />

      {/* How it works */}
      <section id="how" className="py-[88px]">
        <div className="mx-auto max-w-[1180px] px-6">
          <p className="mb-3 text-[12.5px] font-bold uppercase tracking-[0.09em] text-brand-500">
            How it works
          </p>
          <h2 className="mb-3.5 max-w-[19ch] text-[clamp(30px,4.2vw,44px)] font-extrabold leading-[1.08] tracking-[-0.035em]">
            Three steps, no phone tag
          </h2>
          <p className="mb-13 max-w-[59ch] text-[17px] text-muted-ink">
            From noticing the problem to having a professional booked - all without making a single call.
          </p>

          <div className="mt-13 grid grid-cols-1 gap-[22px] min-[860px]:grid-cols-3">
            {STEPS.map((s) => (
              <Card key={s.title} className="rounded-3xl border border-line bg-canvas p-[26px] ring-0">
                <div className="mb-4 grid size-[42px] place-items-center rounded-[13px] bg-brand">
                  <svg width="19" height="19" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    {s.icon}
                  </svg>
                </div>
                <h3 className="mb-[7px] text-[19px] font-bold tracking-[-0.022em]">{s.title}</h3>
                <p className="m-0 text-[15px] text-muted-ink">{s.body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Promises */}
      <section id="why" className="border-y border-line bg-canvas py-[76px]">
        <div className="mx-auto max-w-[1180px] px-6">
          <div className="grid grid-cols-1 gap-8 min-[860px]:grid-cols-3 min-[860px]:gap-10">
            {PROMISES.map((p) => (
              <div key={p.title}>
                <div className="mb-[15px] grid size-[38px] place-items-center rounded-xl bg-brand-100">
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    {p.icon}
                  </svg>
                </div>
                <h4 className="mb-2 text-[18px] font-bold tracking-[-0.02em]">{p.title}</h4>
                <p className="m-0 text-[15px] text-muted-ink">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tradesperson CTA */}
      <section className="py-[88px]">
        <div className="mx-auto max-w-[1180px] px-6">
          <div className="relative flex flex-wrap items-center justify-between gap-10 overflow-hidden rounded-[32px] bg-brand px-14 py-[60px] text-white">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-[90px] -top-[90px] size-[340px] rounded-full"
              style={{
                background:
                  "radial-gradient(circle, rgba(255,255,255,.07) 0%, rgba(255,255,255,0) 70%)",
              }}
            />
            <div>
              <h2 className="mb-3 max-w-[18ch] text-[clamp(27px,3.6vw,38px)] font-extrabold leading-[1.1] tracking-[-0.032em]">
                Run a trade business?
              </h2>
              <p className="m-0 max-w-[48ch] text-[16.5px] text-[#A9BDD4]">
                Set your hours, rates and service area. Get booked by customers who need your work - without chasing quotes or callbacks.
              </p>
            </div>
            <Button
              variant="secondary"
              render={<Link href="/profile/create" />}
              className="relative z-10 h-auto whitespace-nowrap rounded-full px-8 py-4 text-base font-bold text-brand hover:bg-brand-50"
            >
              Create your profile
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-line py-10">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-5 px-6 text-sm text-faint">
          <span>© 2026 TradeTies</span>
          <nav className="flex flex-wrap gap-6">
            {["About us", "Help centre", "How it works", "For professionals", "Terms", "Privacy"].map((l) => (
              <a key={l} href="#" className="no-underline hover:text-brand">
                {l}
              </a>
            ))}
          </nav>
        </div>
      </footer>
    </>
  );
}
