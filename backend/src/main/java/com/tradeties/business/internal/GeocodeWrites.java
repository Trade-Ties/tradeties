package com.tradeties.business.internal;

import java.time.Instant;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * The write half of {@link GeocodeRefiner}, in its own bean so that its transaction exists.
 *
 * <p>Not a style choice. {@code @Transactional} is applied by a proxy around the bean, so a method
 * calling another method of the <em>same</em> class goes straight past it — the annotation would
 * be there, read as working, and do nothing, and every update would fail for want of a
 * transaction. Splitting the two puts a proxy between them.
 *
 * <p>It also puts the transaction where it belongs. The refiner's slow part is an HTTP round trip
 * to somebody else's service; with the boundary here, that happens outside the transaction instead
 * of holding a database connection open for the length of it.
 */
@Component
class GeocodeWrites {

	private static final Logger log = LoggerFactory.getLogger(GeocodeWrites.class);

	private final BusinessProfileRepository businesses;

	GeocodeWrites(BusinessProfileRepository businesses) {
		this.businesses = businesses;
	}

	/**
	 * Records what the geocoder found, or that it looked and found nothing.
	 *
	 * <p>The row count is read rather than dropped, and that is the only way a refused write is
	 * ever visible. The guard in the statement rejects a profile that was saved while the call was
	 * in flight; without reading the count, the pass would report that profile as sharpened, no
	 * attempt would have been stamped, and the same race could repeat on every pass with nothing
	 * in the log to show for it.
	 *
	 * @param answer must not be {@link GeocodeAnswer.Unavailable} — nothing was learned, so there
	 *        is nothing to record, and the caller ends the pass instead
	 * @return whether a better point was stored, which needs both an answer and a row
	 */
	@Transactional
	boolean record(BusinessProfile profile, GeocodeAnswer answer) {
		Geocode found = answer instanceof GeocodeAnswer.Located located ? located.geocode() : null;

		int rows = businesses.recordGeocodeAttempt(profile.id(), profile.version(), Instant.now(),
				found == null ? null : found.point().latitude(),
				found == null ? null : found.point().longitude(),
				found == null ? null : found.precision());

		if (rows == 0) {
			// Not an error: the profile was saved, or sharpened by another pass, between the read
			// and here. The point in hand describes an address this row may no longer have, so
			// dropping it is the whole purpose of the guard.
			log.debug("Geocode for {} discarded: the profile changed while the call was in flight",
					profile.id());
			return false;
		}

		return found != null;
	}
}
