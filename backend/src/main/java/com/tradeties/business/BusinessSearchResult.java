package com.tradeties.business;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * One tradesperson a search turned up.
 *
 * <p>Everything a customer needs to choose between two of them, and nothing that names a person.
 * That second half is a property of this record rather than of the controller: the operation is
 * anonymous on the strength of what is in here, so a field added carelessly is a decision about
 * privacy whether or not anybody treats it as one.
 *
 * @param primaryTrade what the business leads with, or {@code null} for a profile that has none —
 *                     possible only for one published before the checklist required it
 * @param distanceMiles straight line from the centre of the searched postal code, which is what
 *                      orders the list. Not a drive time, and no more accurate than the two
 *                      centroids it is measured between
 * @param timeZone the IANA zone {@code nextSlots} is to be read against. It is the tradesperson's
 *                 working day being described, and nine in the morning is nine where they work
 * @param hourlyRate the general rate, or {@code null} for a business that has not filled its
 *                   pricing in — which is common, and says nothing about the business
 * @param offersThisJob whether this business lists the picked job, or null when none was picked.
 *                      Null and {@code FALSE} are different answers — one is "nobody asked", the
 *                      other "we looked". It says listed rather than able: service lists average
 *                      three entries for businesses that do thirty kinds of work, so false covers
 *                      the plumber who can fix a toilet and never wrote it down. Which is why it
 *                      sorts the results and does not filter them
 * @param serviceId the business's own service for the picked job, which a booking of it names.
 *                  Present exactly when {@code offersThisJob} is true, and {@code nextSlots} are
 *                  then measured by its length
 * @param licensed whether an unexpired licence is on file. False covers "no licence needed in
 *                 this trade and state" as well as "not entered", so it is worth a badge when
 *                 true and worth silence when false
 * @param licenseVerified whether one of those licences has been checked against the issuing
 *                        state. Never true while {@code licensed} is false, and deliberately
 *                        about the licence rather than about the person holding it
 * @param nextSlots the soonest start times this business is free, earliest first. Empty is an
 *                  ordinary answer, and nothing here is held or reserved
 * @param freeInWindow whether one of {@code nextSlots} falls inside the days the customer asked
 *                     for, or null when they asked for none. Null and false differ the way they do
 *                     for {@code offersThisJob}
 * @param services up to five of its bookable services by name, in its own order — with the picked
 *                 job first when it lists that job. Empty for a business that has listed none
 */
public record BusinessSearchResult(
		String slug,
		String displayName,
		String city,
		String state,
		String primaryTrade,
		double distanceMiles,
		String timeZone,
		BigDecimal hourlyRate,
		Boolean offersThisJob,
		UUID serviceId,
		boolean licensed,
		boolean licenseVerified,
		List<Instant> nextSlots,
		List<String> services,
		Boolean freeInWindow) {

	public BusinessSearchResult {
		nextSlots = nextSlots == null ? List.of() : List.copyOf(nextSlots);
		services = services == null ? List.of() : List.copyOf(services);
	}
}
