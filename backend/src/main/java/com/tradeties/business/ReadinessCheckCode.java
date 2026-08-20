package com.tradeties.business;

/**
 * All five read from more than one table, which is why they live in a service rather than
 * in the schema — and two of them are the ones DATAMODEL section 13.4 names as unenforceable
 * by constraint.
 */
public enum ReadinessCheckCode {

	/**
	 * Exactly one. The partial unique index enforces <em>at most</em> one, which is right for
	 * a draft mid-edit; that there is one at all can only be checked when publishing.
	 */
	PRIMARY_TRADE,

	/** Without a service, an appointment has no duration and nothing can be booked. */
	AT_LEAST_ONE_SERVICE,

	/**
	 * Either the service carries its own rate or the business has a general one. The rule
	 * reads from two tables, so no constraint can hold it.
	 */
	HOURLY_SERVICES_HAVE_A_RATE,

	/**
	 * A request snapshots the cancellation fee and notice period when it is sent. Without
	 * rates there is nothing to snapshot, and no request could be made.
	 */
	PRICING_SET,

	/** Bookable with no working hours means bookable with no free slots, ever. */
	WORKING_HOURS_SET
}
