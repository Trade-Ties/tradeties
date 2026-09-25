"use client";

import { Star } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import type { DemoReview } from "./demo-data";

/**
 * Five stars filled to `rating`, fractions included, so 4.8 reads as four and most of a fifth.
 *
 * Each star is filled on its own — an empty star with a filled one laid over it and clipped to
 * that star's share — rather than one filled row clipped across the whole width. Clipping the row
 * also counts the gaps between stars, so the part-filled star comes out wrong by however much
 * the gaps take up, and more so the smaller the stars are drawn.
 */
function Stars({
  rating,
  className,
  gap = "gap-1",
}: {
  rating: number;
  className: string;
  gap?: string;
}) {
  const clamped = Math.min(Math.max(rating, 0), 5);

  return (
    <span aria-hidden="true" className={cn("inline-flex", gap)}>
      {Array.from({ length: 5 }, (_, i) => {
        const fill = Math.min(Math.max(clamped - i, 0), 1);

        return (
          <span key={i} className={cn("relative shrink-0", className)}>
            <Star className="absolute inset-0 size-full text-slate-200" fill="currentColor" />
            {fill > 0 && (
              <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                {/* Sized to the star, not to the clipping box, or a part-filled star shrinks
                    instead of being cut. */}
                <Star className={cn("absolute top-0 left-0 text-amber-400", className)} fill="currentColor" />
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

const formatAverage = (value: number) => value.toFixed(1);

const reviewsLabel = (count: number) => `${count} customer review${count === 1 ? "" : "s"}`;

/**
 * The tradesperson's rating at a glance — average, stars and count — opening onto what customers
 * actually wrote.
 *
 * Worked out from the reviews rather than handed in beside them, so the figure and the list
 * under it cannot disagree.
 */
export function RatingBadge({ reviews }: { reviews: DemoReview[] }) {
  if (reviews.length === 0) {
    return (
      <div className="flex flex-col items-end">
        <span className="flex h-9 items-center">
          <Stars rating={0} className="size-5" />
        </span>
        <p className="mt-1 text-muted-ink">No customer reviews yet</p>
      </div>
    );
  }

  const count = reviews.length;
  const average = reviews.reduce((sum, r) => sum + r.rating, 0) / count;
  const perStar = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: reviews.filter((r) => r.rating === stars).length,
  }));

  return (
    <Popover>
      <PopoverTrigger
        aria-label={`Rated ${formatAverage(average)} out of 5 from ${reviewsLabel(count)}. Show reviews`}
        // Two lines set like the welcome heading beside it — the figure at the heading's size,
        // the count at the subtitle's — so the pair lines up across the header. The top line is
        // spread across the width the count sets, figure at one end and stars at the other, so
        // both lines start and end together; the stars are sized to fit inside that width.
        className="group flex cursor-pointer flex-col items-stretch rounded-lg text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:outline-none"
      >
        <span className="flex items-center justify-between gap-2">
          <span className="text-3xl font-bold tracking-[-0.02em] text-brand">
            {formatAverage(average)}
          </span>
          <Stars rating={average} className="size-4" gap="gap-0.5" />
        </span>
        <span className="mt-1 text-muted-ink underline-offset-2 group-hover:underline">
          {reviewsLabel(count)}
        </span>
      </PopoverTrigger>

      <PopoverContent align="end" sideOffset={10} className="w-[min(24rem,calc(100vw-2rem))] gap-0 p-0">
        <div className="flex items-center gap-5 border-b border-line p-4">
          <div className="flex flex-col items-start gap-1">
            <p className="text-3xl font-bold leading-none text-brand">{formatAverage(average)}</p>
            <Stars rating={average} className="size-3.5" />
            <p className="text-xs text-muted-ink">{reviewsLabel(count)}</p>
          </div>

          <ul className="flex-1 space-y-1" aria-label="Reviews by star rating">
            {perStar.map(({ stars, count: n }) => (
              <li key={stars} className="flex items-center gap-2 text-xs text-muted-ink">
                <span className="w-2 tabular-nums">{stars}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
                  <span
                    className="block h-full rounded-full bg-amber-400"
                    style={{ width: `${(n / count) * 100}%` }}
                  />
                </span>
                <span className="sr-only">{`${stars} stars: ${n}`}</span>
              </li>
            ))}
          </ul>
        </div>

        <ul className="max-h-80 divide-y divide-line overflow-y-auto">
          {reviews.map((review) => (
            <li key={review.id} className="space-y-1.5 p-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-semibold text-brand">{review.customerName}</p>
                <p className="shrink-0 text-xs text-muted-ink">{review.postedLabel}</p>
              </div>
              <Stars rating={review.rating} className="size-3.5" />
              <span className="sr-only">{`${review.rating} out of 5 stars`}</span>
              <p className="text-sm text-foreground">{review.text}</p>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
