package com.tradeties.availability;

import java.time.Instant;
import java.util.UUID;

/**
 * What a module writing an appointment has to ask this one first.
 *
 * <p>Declared here and used by {@code job}, which is the direction that keeps the arrow pointing
 * one way: this module already depends on {@code business}, and a calendar that knew about jobs
 * would close a cycle Spring Modulith rejects.
 */
public interface CalendarGuard {

	/**
	 * Takes the lock every calendar write serialises on, and answers the rules that write is
	 * bound by.
	 *
	 * <p><strong>The lock is the point; the rules are what it happens to return.</strong> The
	 * exclusion constraint on accepted appointments only catches two of them genuinely
	 * overlapping. It cannot catch one being accepted while, in parallel, time off is entered over
	 * the same hours or that weekday's working hours are shortened. Every such path takes this
	 * lock, and a path that skips it makes the rule worthless for the others too.
	 *
	 * <p>Held until the caller's transaction ends, so it must be called inside one.
	 */
	BookingRules lockForWriting(UUID businessId);

	/**
	 * Whether declared time off covers any part of a span.
	 *
	 * <p>Half-open at both ends, like the working hours: time off ending at 13:00 leaves an
	 * appointment starting at 13:00 alone.
	 */
	boolean isAway(UUID businessId, Instant startsAt, Instant endsAt);
}
