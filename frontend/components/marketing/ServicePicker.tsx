"use client";

import { useRouter } from "next/navigation";
import { Check, Clock } from "lucide-react";

import { duration, money } from "@/components/marketing/business-format";
import { proPath } from "@/lib/routes";
import type { PublicBusinessProfile, PublicService } from "@/lib/api/marketplace";

type Pricing = PublicBusinessProfile["pricing"];

/**
 * What this business does, as the question the calendar below is waiting on.
 *
 * <p>Picking one navigates rather than fetching: the choice belongs in the URL, because a request
 * is for exactly one service — `job_request.service_id` is singular — so there is no basket that
 * could not be written down as an address. The link is shareable and survives a reload, which is
 * the reasoning the search already runs on.
 */
export function ServicePicker({
  slug,
  services,
  pricing,
  picked,
  month,
}: {
  slug: string;
  services: PublicService[];
  pricing: Pricing;
  picked: string | null;
  /**
   * The month the URL carries, or null when it carries none. Kept across a change of service, so
   * somebody comparing two jobs in November is not thrown back to today — but never written in
   * when it was absent, or a link shared today would show a stale month tomorrow.
   */
  month: string | null;
}) {
  const router = useRouter();

  const pick = (service: PublicService) => {
    const params = new URLSearchParams({ service: service.id });
    if (month) params.set("month", month);

    router.push(`${proPath(slug)}?${params}`);
  };

  return (
    <div className="flex flex-col gap-2.5">
      {services.map((service) => {
        const chosen = service.id === picked;

        return (
          <button
            key={service.id}
            type="button"
            aria-pressed={chosen}
            onClick={() => pick(service)}
            className={
              chosen
                ? "flex w-full flex-row flex-wrap items-start justify-between gap-4 rounded-2xl border-2 border-brand bg-brand-50 p-5 text-left"
                : "flex w-full flex-row flex-wrap items-start justify-between gap-4 rounded-2xl border border-line bg-white p-5 text-left transition-colors hover:border-brand-100 hover:bg-brand-50/40"
            }
          >
            <div className="min-w-[220px] flex-1">
              <p className="m-0 flex items-center gap-2 text-[15.5px] font-semibold tracking-[-0.01em]">
                {service.name}
                {chosen && <Check className="size-4 shrink-0 text-brand-500" aria-hidden="true" />}
              </p>
              {service.description && (
                <p className="m-0 mt-1 text-[14px] leading-relaxed text-muted-ink">{service.description}</p>
              )}
              <p className="m-0 mt-2 inline-flex items-center gap-1.5 text-[13px] text-faint">
                <Clock className="size-3.5" aria-hidden="true" />
                {duration(service.estimatedDurationMinutes)} in the calendar
              </p>
            </div>

            <p className="m-0 whitespace-nowrap text-[15px] font-bold text-brand">
              {priceOf(service, pricing)}
            </p>
          </button>
        );
      })}
    </div>
  );
}

/**
 * What one service costs, in its own mode.
 *
 * An hourly service may carry a rate of its own, and it overrides the general one — that is what
 * an emergency call-out at a higher tariff is. Absent on both is a question nobody has answered
 * rather than work given away, so it says so instead of printing a zero.
 */
function priceOf(service: PublicService, pricing: Pricing): string {
  switch (service.pricingMode) {
    case "FLAT":
      return service.price ? money(service.price) : "Price on request";
    case "STARTING_AT":
      return service.price ? `From ${money(service.price)}` : "Price on request";
    case "HOURLY": {
      const rate = service.price ?? pricing.hourlyRate;
      return rate ? `${money(rate)}/hr` : "Hourly rate on request";
    }
    case "QUOTE_ONLY":
      return "Quoted after a look";
  }
}
