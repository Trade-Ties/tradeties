package com.tradeties.business;

/**
 * Everything a tradesperson supplies about their business in onboarding steps 1 and 2.
 *
 * <p>The same shape for creating and for replacing, because the contract makes the update a full
 * replacement rather than a merge. What the two calls do not share is the {@code version}, which
 * only a replacement carries — so it is a parameter of the call, not a field here.
 *
 * @param coordinates {@code null} unless the tradesperson dragged the map pin to correct
 *                    the geocoded position. Carried because the contract offers it, and not yet
 *                    read: the server geocodes the address on every write instead — see
 *                    {@code BusinessService.locate}
 */
public record BusinessInput(
		String slug,
		String legalName,
		String displayName,
		String description,
		String websiteUrl,
		String phone,
		String email,
		PostalAddress address,
		GeoPoint coordinates,
		String timeZone,
		int serviceRadiusMiles) {
}
