package com.tradeties.business.internal;

import com.tradeties.business.GeoPoint;

/**
 * A located address: where it is, and how well that is known.
 *
 * <p>The two travel together for the reason {@link GeoPoint} gives for its own pair — a point
 * whose precision has been dropped along the way reads as exact, and six decimal places make that
 * reading look justified.
 */
record Geocode(GeoPoint point, GeocodePrecision precision) {

	Geocode {
		if (point == null || precision == null) {
			throw new IllegalArgumentException("A geocode needs both a point and its precision");
		}
	}
}
