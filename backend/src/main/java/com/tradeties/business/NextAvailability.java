package com.tradeties.business;

import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * The next times a business could take a job.
 *
 * <p><strong>Declared here and implemented in {@code availability}.</strong> The same shape as
 * {@link CalendarReadiness} and for the same reason: that module already depends on this one to
 * resolve which business a caller owns, so depending back on it would close a cycle. The consumer
 * owns the interface, the provider implements it, and the arrow still runs one way.
 *
 * <p>The zone travels with the request rather than being looked up on the other side, because it
 * belongs to this module — it sits on the profile, beside the address it was derived from.
 * Working hours are a wall clock ("Mondays from 8"), and turning a wall clock into a moment is
 * the one thing the calendar cannot do on its own. Passing it at the call keeps that dependency
 * where it can be seen instead of routing it back through a second port.
 */
public interface NextAvailability {

	/**
	 * @param businesses which businesses to answer for, each with the zone its working hours are
	 *        read against. All of them at once because the caller is a page of search results:
	 *        one round of queries for the page, not one per row
	 * @param perBusiness how many start times to look for. Walking further down the calendar for
	 *        slots nobody displays costs the search and buys nothing
	 * @return start times, soonest first. Short or absent for a business whose week is closed,
	 *         whose calendar was never configured, or that is away until past the horizon. A
	 *         missing key and an empty list say the same thing, and no caller need tell them apart
	 */
	Map<UUID, List<Instant>> nextSlots(Map<UUID, ZoneId> businesses, int perBusiness);
}
