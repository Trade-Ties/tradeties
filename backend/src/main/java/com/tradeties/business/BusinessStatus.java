package com.tradeties.business;

/**
 * A domain enum of its own rather than the generated wire enum: the entity maps its column
 * through this type, and mapping it through a generated one would mean a rename in
 * {@code api/openapi.yaml} silently changing what gets written to the database. The same three
 * names appear in {@code V3__business_profile.sql} as a {@code CHECK}, held in step by hand — a
 * divergence shows up as a write failure, not as a build failure.
 */
public enum BusinessStatus {

	DRAFT,

	PUBLISHED,

	/**
	 * Taken out of the marketplace without being deleted. Accepted appointments, fees and
	 * reviews point at a business, so it leaves the search rather than the database.
	 */
	SUSPENDED
}
