package com.tradeties.business.internal;

import java.util.Optional;

import com.tradeties.business.PostalAddress;

/**
 * Turns an address into a point, on the write path.
 *
 * <p>One method, so that what fills the coordinates can be swapped without the callers knowing.
 * Today it is a lookup in {@code zip_centroid}, which can always answer from a table that is
 * always there.
 *
 * <p><strong>{@link CensusGeocoder} is deliberately not one of these.</strong> It answers from
 * somebody else's service, so it has an outcome this interface cannot express — "could not ask" —
 * and it must never be reachable from a save. Keeping the two types apart is what makes wiring it
 * to the write path a compile error rather than a comment asking nobody to do it.
 */
interface Geocoder {

	/** The length of the key in {@code zip_centroid}, which is also what the Census takes. */
	int FIVE_DIGITS = 5;

	/**
	 * The five digits every lookup keys on, from a column that holds either spelling.
	 *
	 * <p>Here rather than in one implementation because both need the same answer. A ZIP+4 sent
	 * as typed matches nothing on either side, and the profiles that would silently lose are the
	 * ones filled in most carefully.
	 *
	 * @return empty for anything shorter than five characters. The contract's pattern has already
	 *         refused those at the door, so reaching here with one means the caller is not the API
	 */
	static Optional<String> fiveDigitZip(String postalCode) {
		return postalCode == null || postalCode.length() < FIVE_DIGITS
				? Optional.empty()
				: Optional.of(postalCode.substring(0, FIVE_DIGITS));
	}

	/**
	 * @return empty when the address cannot be located, which is a normal answer and not an error.
	 *         Not every ZIP has a centroid — PO-box-only codes have no ZCTA — and an address-level
	 *         provider will fail on far more than that. The profile is then stored without
	 *         coordinates, exactly as it is today, and the readiness check is what stops it going
	 *         live unfindable.
	 */
	Optional<Geocode> locate(PostalAddress address);
}
