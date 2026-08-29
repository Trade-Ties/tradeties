package com.tradeties.business.internal;

import java.util.Optional;

import com.tradeties.business.PostalAddress;

import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Locates an address by the centroid of its ZIP code.
 *
 * <p>Reads only the postal code, and that is the whole of it — street and city are carried past
 * untouched. Which sets the accuracy at the size of a ZIP area, and that is the accuracy the
 * search can use anyway: the customer types a ZIP into the search box, never a street, so the
 * other end of every distance is a centroid too.
 *
 * <p>The five digits are what the table is keyed on, so a ZIP+4 is cut down to them. The contract
 * accepts both spellings of the same postal code and the extra four narrow it to a block — a
 * distinction {@code zip_centroid} does not make and does not need to.
 */
/**
 * The default {@link Geocoder}, and {@code @Primary} says which of the two that is. This one can
 * always answer, from a table that is always there — {@link CensusGeocoder} depends on somebody
 * else's service being up, and is asked for by name where it is wanted.
 */
@Component
@Primary
class ZipCentroidGeocoder implements Geocoder {

	/** The length of the key in {@code zip_centroid}, which a ZIP+4 is trimmed to. */
	private static final int ZIP = 5;

	private final CatalogZipRepository zips;

	ZipCentroidGeocoder(CatalogZipRepository zips) {
		this.zips = zips;
	}

	@Override
	@Transactional(readOnly = true)
	public Optional<Geocode> locate(PostalAddress address) {
		return fiveDigitsOf(address)
				.flatMap(zips::findById)
				.map(zip -> new Geocode(zip.toPoint(), GeocodePrecision.ZIP));
	}

	/**
	 * Empty rather than an exception for a code that is not five digits long. The contract's
	 * pattern has already refused those at the door; reaching here with one means the caller is
	 * not the API, and a lookup that finds nothing is the same answer as a lookup for a ZIP the
	 * Census does not list.
	 */
	private static Optional<String> fiveDigitsOf(PostalAddress address) {
		String postalCode = address.postalCode();

		return postalCode == null || postalCode.length() < ZIP
				? Optional.empty()
				: Optional.of(postalCode.substring(0, ZIP));
	}
}
