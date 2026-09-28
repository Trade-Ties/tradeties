import { BadgeCheck, Globe, MapPin } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { ProCardView } from "./ProCard";

/**
 * The card shown on hover — a fuller snapshot of the profile, not a way to reach the person.
 * No phone, no email, nothing this marketplace doesn't already put on a public profile; the
 * website shown here is display text, not a link — there's no page behind it yet, and a fake
 * domain pointing somewhere real would be worse than not linking it at all.
 */
export function ProfilePreviewCard({ view }: { view: ProCardView }) {
  const facts = [
    view.rating === undefined ? null : (
      <span key="rating">
        ★ <strong className="font-semibold text-brand">{view.rating.toFixed(1)}</strong>
      </span>
    ),
    view.jobs === undefined ? null : <span key="jobs">{view.jobs} jobs</span>,
    <span key="distance">{view.distance}</span>,
  ].filter((fact) => fact !== null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3.5">
        <div
          className="grid size-16 shrink-0 place-items-center rounded-full text-xl font-bold tracking-[-0.02em] text-white"
          style={{ background: view.color }}
        >
          {view.initials}
        </div>
        <div className="min-w-0">
          <p className="truncate text-lg font-bold leading-tight tracking-[-0.02em] text-brand">{view.title}</p>
          <p className="truncate text-sm text-muted-ink">{view.subtitle}</p>
        </div>
      </div>

      {view.trade && (
        <Badge className="h-auto w-fit rounded-full border-transparent bg-brand-50 px-3 py-1 text-[11.5px] font-semibold text-brand-500">
          {view.trade}
        </Badge>
      )}

      {view.website && (
        <div className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium text-muted-ink">
          <Globe className="size-3.5 shrink-0 text-faint" />
          <span className="truncate">{view.website}</span>
        </div>
      )}

      {view.location && (
        <div className="flex items-center gap-1.5 text-[13px] text-muted-ink">
          <MapPin className="size-3.5 shrink-0 text-faint" />
          {view.location}
        </div>
      )}

      {facts.length > 0 && (
        <div className="flex items-center gap-2.5 text-sm text-muted-ink">
          {facts.map((fact, index) => (
            <span key={index} className="contents">
              {index > 0 && <span className="text-[#CBD6E2]">•</span>}
              {fact}
            </span>
          ))}
        </div>
      )}

      {view.services && view.services.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">Services</p>
          <div className="flex flex-wrap gap-1.5">
            {view.services.map((service) => (
              <span
                key={service}
                className="rounded-full border border-line bg-canvas px-2.5 py-1 text-[12px] font-medium text-muted-ink"
              >
                {service}
              </span>
            ))}
          </div>
        </div>
      )}

      {view.badges.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t border-line pt-3.5 text-[13px] font-medium text-muted-ink">
          {view.badges.map((badge) => (
            <span key={badge} className="inline-flex items-center gap-1.5">
              <BadgeCheck className="size-4 shrink-0 text-go" />
              {badge}
            </span>
          ))}
        </div>
      )}

      {view.rateFrom !== undefined && (
        <p className="text-sm font-semibold text-faint">
          From <span className="font-bold text-brand">${view.rateFrom}</span>/hr
        </p>
      )}
    </div>
  );
}
