package com.tradeties.business.internal;

import java.time.Instant;
import java.util.Optional;

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

	private final BusinessProfileRepository businesses;

	GeocodeWrites(BusinessProfileRepository businesses) {
		this.businesses = businesses;
	}

	/**
	 * Records what the geocoder found, or that it found nothing.
	 *
	 * @param located empty when the address could not be matched, which still stamps the attempt —
	 *        that stamp is the only thing standing between an unmatchable address and being asked
	 *        about on every pass, forever
	 */
	@Transactional
	void record(BusinessProfile profile, Optional<Geocode> located) {
		businesses.recordGeocodeAttempt(profile.id(), Instant.now(),
				located.map(geocode -> geocode.point().latitude()).orElse(null),
				located.map(geocode -> geocode.point().longitude()).orElse(null),
				located.map(Geocode::precision).orElse(null));
	}
}
