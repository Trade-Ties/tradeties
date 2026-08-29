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
 * <p>Free, keyless and US-only, which is this market. The cost is that it can be down, and that
 * cost is carried in the return type rather than hidden in an empty answer — see
 * {@link GeocodeAnswer}.
 *
 * <p><strong>Deliberately not a {@link Geocoder}.</strong> It answers from somebody else's
 * service and has an outcome that interface cannot express, so keeping the types apart is what
 * makes wiring this to a save a compile error instead of a comment asking nobody to do it.
 */
@Component
class CensusGeocoder {

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
	 * @return {@link GeocodeAnswer#NOT_FOUND} for an address the service does not know, and
	 *         {@link GeocodeAnswer#UNAVAILABLE} when it could not be asked. Two answers rather
	 *         than one empty: the caller records an attempt for the first and must not for the
	 *         second, because a stamp written after an outage defers the profile for the whole
	 *         retry window on the strength of a call nobody made
	 */
	GeocodeAnswer locate(PostalAddress address) {
		CensusLocations.Locations answer;
		try {
			answer = census.locate(street(address), address.city(), address.state(),
					zip(address), BENCHMARK, FORMAT);
		}
		catch (RestClientException unreachable) {
			log.warn("Census geocoder did not answer for {} {}: {}",
					address.city(), address.state(), unreachable.getMessage());
			return GeocodeAnswer.UNAVAILABLE;
		}

		return firstMatch(answer)
				.<GeocodeAnswer>map(point -> new GeocodeAnswer.Located(
						new Geocode(point, GeocodePrecision.STREET)))
				.orElse(GeocodeAnswer.NOT_FOUND);
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
				.map(CensusLocations.Locations.Match::coordinates)
				// Filtered before the first is taken, not after: a leading match with no point
				// would otherwise answer for the whole list and throw away the usable ones behind
				// it.
				.filter(point -> point != null && point.x() != null && point.y() != null)
				.findFirst()
				// y then x. The record says which is which, and this is the line that would be
				// wrong if anyone trusted the order they are written in.
				.map(point -> new GeoPoint(stored(point.y()), stored(point.x())));
	}

	/**
	 * The postal code as the service wants it. A ZIP+4 is cut to five the same way the centroid
	 * lookup cuts it — sent as typed it narrows the search to a block the service cannot resolve,
	 * and the address is quietly never matched.
	 *
	 * <p>Empty rather than absent for a code too short to trim, so the street, city and state can
	 * still carry the request.
	 */
	private static String zip(PostalAddress address) {
		return Geocoder.fiveDigitZip(address.postalCode()).orElse("");
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
