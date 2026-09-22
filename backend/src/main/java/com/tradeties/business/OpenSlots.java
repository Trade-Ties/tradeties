package com.tradeties.business;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;

/**
 * <strong>Declared here and implemented in {@code availability}</strong>, like
 * {@link CalendarReadiness} and {@link NextAvailability} and for the same reason: that module
 * already depends on this one to resolve which business a caller owns, so depending back on it
 * would close a cycle Spring Modulith rejects.
 *
 * <p><strong>A third narrow port rather than a method on {@link NextAvailability}</strong>,
 * because the two answer different questions and are asked in different shapes. That one is "when
 * is this business next free at all", asked of fifty businesses at once to fill a page of search
 * results, with no service in hand and therefore no length to cut by. This one is "when can this
 * business do this job, between these two days", asked of one business by somebody who has read
 * the profile and chosen. One interface holding both would let a caller reach for the wrong
 * shape — and the wrong shape here is the one that answers without knowing how long the work
 * takes.
 */
public interface OpenSlots {

	/**
	 * @param zone the business's own zone, passed in rather than read on the other side: the
	 *        profile that holds it belongs to the module on this side of the arrow
	 * @param from the first day to read, in {@code zone}. Moved later if the notice the
	 *        tradesperson requires reaches into it
	 * @param to the last day to read, inclusive. Moved earlier if the booking horizon falls short
	 *        of it
	 * @param appointmentMinutes how long the chosen service takes. The grid decides where a slot
	 *        may start and this decides whether it fits, which is why a caller with no service
	 *        has no business here
	 * @param limit how many starts are worth walking for, reported back through
	 *        {@link Openings#capped()} when it is what stopped the walk
	 */
	Openings within(UUID businessId, ZoneId zone, LocalDate from, LocalDate to,
			int appointmentMinutes, int limit);
}
