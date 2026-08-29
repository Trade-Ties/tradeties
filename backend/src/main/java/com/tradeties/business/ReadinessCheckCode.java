package com.tradeties.business;

/**
 * What none of these are is row-local. Each is a rule about going live rather than about a
 * stored row — a draft mid-edit may fail every one of them and is still a valid profile — which
 * is why they live in a service and not in the schema. Two of them are the ones DATAMODEL
 * section 13.4 names as unenforceable by constraint.
 *
 * <p>Declared in the order the wizard asks them, which is the order they are shown in.
 */
public enum ReadinessCheckCode {

	/**
	 * The address resolved to a point. The odd one out: every other condition is something the
	 * tradesperson has not supplied yet, and this one is something they supplied that could not
	 * be located. It is a publishing condition all the same — coordinates are what put a profile
	 * into a radius search, so without them going live means being live and unfindable.
	 */
	ADDRESS_GEOCODED,

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
