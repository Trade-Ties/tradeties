package com.tradeties.business.internal;

/**
 * What an address-level geocoder said, which is three things and not two.
 *
 * <p>"No such address" and "nobody answered" used to arrive as the same empty answer, and the
 * caller recorded both as an attempt. With a retry window measured in days that made a passing
 * outage indistinguishable from an address the service will never match: one short outage
 * deferred every profile it touched for the length of the window without a single call having
 * succeeded, and the profiles it reached first were the ones never looked at before.
 *
 * <p>The distinction lives in the type because that is the only place it cannot be forgotten.
 */
sealed interface GeocodeAnswer {

	/** The service answered and does not know this address. Worth recording, so it is left alone. */
	GeocodeAnswer NOT_FOUND = new NotFound();

	/** The service could not be asked. Nothing was learned, so nothing is recorded. */
	GeocodeAnswer UNAVAILABLE = new Unavailable();

	/** The address was placed. */
	record Located(Geocode geocode) implements GeocodeAnswer {
	}

	record NotFound() implements GeocodeAnswer {
	}

	record Unavailable() implements GeocodeAnswer {
	}
}
