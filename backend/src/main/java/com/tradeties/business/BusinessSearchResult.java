package com.tradeties.business;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

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
 * @param licensed whether an unexpired licence is on file. False covers "no licence needed in
 *                 this trade and state" as well as "not entered", so it is worth a badge when
 *                 true and worth silence when false
 * @param licenseVerified whether one of those licences has been checked against the issuing
 *                        state. Never true while {@code licensed} is false, and deliberately
 *                        about the licence rather than about the person holding it
 * @param nextSlots the soonest start times this business is free, earliest first. Empty is an
 *                  ordinary answer, and nothing here is held or reserved
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
		boolean licensed,
		boolean licenseVerified,
		List<Instant> nextSlots) {

	public BusinessSearchResult {
		nextSlots = nextSlots == null ? List.of() : List.copyOf(nextSlots);
	}
}
