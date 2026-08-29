package com.tradeties.business.internal;

import java.util.Optional;

import com.tradeties.business.PostalAddress;

/**
 * Turns an address into a point.
 *
 * <p>One method, so that what fills the coordinates can be swapped without the callers knowing.
 * Today it is a lookup in {@code zip_centroid}; an address-level provider is the same signature
 * with a different {@link Geocode#precision()}, and {@code BusinessService} would not change.
 */
interface Geocoder {

	/**
	 * @return empty when the address cannot be located, which is a normal answer and not an error.
	 *         Not every ZIP has a centroid — PO-box-only codes have no ZCTA — and an address-level
	 *         provider will fail on far more than that. The profile is then stored without
	 *         coordinates, exactly as it is today, and the readiness check is what stops it going
	 *         live unfindable.
	 */
	Optional<Geocode> locate(PostalAddress address);
}
