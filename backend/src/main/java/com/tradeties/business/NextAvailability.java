package com.tradeties.business;

import java.time.Instant;
import java.time.LocalDate;
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
	 * What is asked of one business.
	 *
	 * @param zone what its working hours are read against
	 * @param appointmentMinutes how long the job runs, when the customer picked one this business
	 *        lists, or null when there is no job to measure by. Given, the openings are the ones
	 *        that service's own calendar offers, so a time taken off a result card is still on
	 *        offer on the other side of the click
	 * @param startingOn the first day to look on, on the business's own calendar, or null to look
	 *        from now. A day already past is read as now
	 */
	record Asked(ZoneId zone, Integer appointmentMinutes, LocalDate startingOn) {

		/** From now: the question every caller asked before a customer could name a day. */
		public Asked(ZoneId zone, Integer appointmentMinutes) {
			this(zone, appointmentMinutes, null);
		}
	}

	/**
	 * @param businesses which businesses to answer for, and what is asked of each. All of them at
	 *        once because the caller is a page of search results: one round of queries for the
	 *        page, not one per row
	 * @param perBusiness how many start times to look for. Walking further down the calendar for
	 *        slots nobody displays costs the search and buys nothing
	 * @return start times, soonest first. Short or absent for a business whose week is closed,
	 *         whose calendar was never configured, or that is away until past the horizon. A
	 *         missing key and an empty list say the same thing, and no caller need tell them apart
	 */
	Map<UUID, List<Instant>> nextSlots(Map<UUID, Asked> businesses, int perBusiness);
}
