package com.tradeties.business;

import java.util.Optional;

/**
 * Where an address is, for a module that has one to store.
 *
 * <p>A port because the geocoder itself is internal to {@code business} and must stay that way:
 * there are two of them in there, and only one is safe on a write path. Exposing the interface
 * would expose the choice, and the wrong choice calls somebody else's service from inside a
 * transaction.
 *
 * <p>Only the point comes back, not the precision the profile records. A job site has no
 * refinement queue to feed, and a caller given a precision it has nowhere to put would store it
 * or, worse, branch on it.
 */
public interface SiteLocations {

	/**
	 * @return empty when the address cannot be placed, which is ordinary rather than an error —
	 *         PO-box-only postal codes have no centroid. The row is then stored without
	 *         coordinates, which its own check constraint allows as long as neither is set
	 */
	Optional<GeoPoint> locate(PostalAddress address);
}
