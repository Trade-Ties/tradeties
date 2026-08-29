package com.tradeties.business.internal;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Optional;

import com.tradeties.business.GeoPoint;
import com.tradeties.business.PostalAddress;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;

/**
 * The sharper of the two geocoders: the address rather than the middle of its postal area.
 *
 * <p>Not a replacement for {@link ZipCentroidGeocoder} and not on the write path. A profile is
 * placed by its ZIP the moment it is saved, and this improves that point afterwards — so a
 * service with no availability promise cannot make saving a profile slow or fail. What it
 * upgrades is the precision, from {@link GeocodePrecision#ZIP} to
 * {@link GeocodePrecision#STREET}.
 *
 * <p>Free, keyless and US-only, which is this market. The cost of that is the paragraph below.
 */
@Component
class CensusGeocoder implements Geocoder {

	private static final Logger log = LoggerFactory.getLogger(CensusGeocoder.class);

	/**
	 * Pinned rather than left to the service's own default, which is what an omitted benchmark
	 * gets. A default that moved would move every point taken after it while nothing here changed.
	 */
	private static final String BENCHMARK = "Public_AR_Current";

	private static final String FORMAT = "json";

	/** What {@code NUMERIC(9,6)} holds. Rounded here so the value stored is the value returned. */
	private static final int STORED_DECIMALS = 6;

	private final CensusLocations census;

	CensusGeocoder(CensusLocations census) {
		this.census = census;
	}

	/**
	 * @return empty for an address the service cannot match, and empty when the call fails. The
	 *         two are deliberately one answer here: the caller's move is the same either way —
	 *         leave the ZIP centroid in place and come back to this profile later — and a
	 *         distinction it cannot act on would only be one more branch to get wrong. The
	 *         difference is logged, because it is the difference between a bad address and a
	 *         service that is down, and only one of those is worth being woken for.
	 */
	@Override
	public Optional<Geocode> locate(PostalAddress address) {
		CensusLocations.Locations answer;
		try {
			answer = census.locate(street(address), address.city(), address.state(),
					address.postalCode(), BENCHMARK, FORMAT);
		}
		catch (RestClientException unreachable) {
			log.warn("Census geocoder did not answer for {} {}: {}",
					address.city(), address.state(), unreachable.getMessage());
			return Optional.empty();
		}

		return firstMatch(answer).map(point -> new Geocode(point, GeocodePrecision.STREET));
	}

	/**
	 * The first match, and the rest ignored. More than one comes back where the address ranges of
	 * two TIGER segments both cover the number — the same block from either side — so the extras
	 * are a few metres apart, not a choice between candidates.
	 */
	private static Optional<GeoPoint> firstMatch(CensusLocations.Locations answer) {
		if (answer == null || answer.result() == null || answer.result().addressMatches() == null) {
			return Optional.empty();
		}

		return answer.result().addressMatches().stream()
				.findFirst()
				.map(CensusLocations.Locations.Match::coordinates)
				.filter(point -> point.x() != null && point.y() != null)
				// y then x. The record says which is which, and this is the line that would be
				// wrong if anyone trusted the order they are written in.
				.map(point -> new GeoPoint(stored(point.y()), stored(point.x())));
	}

	/** Street and unit as one line, which is the field the service takes. */
	private static String street(PostalAddress address) {
		return address.street2() == null || address.street2().isBlank()
				? address.street1()
				: address.street1() + " " + address.street2();
	}

	private static BigDecimal stored(BigDecimal coordinate) {
		return coordinate.setScale(STORED_DECIMALS, RoundingMode.HALF_UP);
	}
}
