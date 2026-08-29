package com.tradeties.business.internal;

/**
 * How a {@link Geocode} was arrived at, stored beside the point it describes.
 *
 * <p>One value today, and an enum rather than a boolean because the second and third are already
 * named: an address-level provider answers {@code ROOFTOP} or {@code STREET}, and a dragged map
 * pin answers for itself. Adding one is a line here and a line in the constraint.
 *
 * <p>The values are persisted by name, so they may be reordered and must never be renamed without
 * a migration.
 */
enum GeocodePrecision {

	/**
	 * The centroid of the postal code. Accurate to the size of the ZIP area, which is under a mile
	 * in a city and considerably more in open country.
	 */
	ZIP,

	/**
	 * Interpolated along a street segment, between the house numbers the address range holds for
	 * it. Usually within a house or two — and deliberately not called {@code ROOFTOP}, which is
	 * the building itself and a stronger claim than this makes.
	 */
	STREET
}
