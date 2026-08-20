package com.tradeties.business;

/**
 * A mode rather than a bare amount, because no plumber quotes a fixed price for "leak
 * fix" before seeing it. A plain price column would force a number that cannot be honoured.
 *
 * <p>A domain enum of its own, for the same reason as {@link BusinessStatus}: the entity
 * maps its column through this type, and mapping it through a generated one would let a
 * rename in the contract change what is written to the database.
 */
public enum ServicePricingMode {

	/** Requires an amount. */
	FLAT,

	/** "From $149" — requires an amount. */
	STARTING_AT,

	/**
	 * An amount is optional here and overrides the general hourly rate, which is what an emergency
	 * call-out at a higher tariff needs.
	 */
	HOURLY,

	/** Must not carry an amount. */
	QUOTE_ONLY
}
