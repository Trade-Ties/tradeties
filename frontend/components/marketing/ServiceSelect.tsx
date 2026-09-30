"use client";

import { useRouter } from "next/navigation";

import { proPath } from "@/lib/routes";
import type { PublicService } from "@/lib/api/marketplace";

/**
 * Which of the business's services the appointment is for, as a dropdown.
 *
 * <p>A request names exactly one service — it sets how long the appointment is and what it costs —
 * so the question stays on the page even with the service list gone from it. Picking navigates
 * rather than fetching: the choice belongs in the URL, shareable and surviving a reload, and the
 * calendar and the chosen time are read again for the service now named.
 */
export function ServiceSelect({
  slug,
  services,
  picked,
  month,
  at,
  job,
  calendarOpen,
}: {
  slug: string;
  services: PublicService[];
  picked: string;
  /**
   * The month the URL carries, or null. Kept across a change of service, so somebody comparing two
   * jobs in November is not thrown back to today — but never written in when it was absent.
   */
  month: string | null;
  /** The time picked off a search card, kept across a change; whether it suits is the calendar's to say. */
  at: string | null;
  /** What the customer searched for, kept for the booking form. */
  job: string | null;
  /** Whether the calendar was asked for, which a change of service should not close again. */
  calendarOpen: boolean;
}) {
  const router = useRouter();

  const pick = (serviceId: string) => {
    const params = new URLSearchParams({ service: serviceId });
    if (month) params.set("month", month);
    if (at) params.set("at", at);
    if (job) params.set("job", job);
    if (calendarOpen) params.set("calendar", "1");

    router.push(`${proPath(slug)}?${params}`, { scroll: false });
  };

  if (services.length < 2) return null;

  return (
    <label className="flex min-w-0 items-center gap-2 text-[13px] font-semibold text-muted-ink">
      Service
      <select
        value={picked}
        onChange={(event) => pick(event.target.value)}
        className="h-9 min-w-0 max-w-[260px] rounded-full border border-line bg-white px-3 text-[13.5px] font-semibold text-brand outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30"
      >
        {services.map((service) => (
          <option key={service.id} value={service.id}>
            {service.name}
          </option>
        ))}
      </select>
    </label>
  );
}
