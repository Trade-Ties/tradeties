package com.tradeties.business;

/**
 * One tradesperson a search turned up.
 *
 * @param primaryTrade what the business leads with, or {@code null} for a profile that has none —
 *                     possible only for one published before the checklist required it
 * @param distanceMiles straight line from the centre of the searched postal code, which is what
 *                      orders the list. Not a drive time, and no more accurate than the two
 *                      centroids it is measured between
 */
public record BusinessSearchResult(
		String slug,
		String displayName,
		String city,
		String state,
		String primaryTrade,
		double distanceMiles) {
}
