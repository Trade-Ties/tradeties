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
 * <p>The five digits are what the table is keyed on, so a ZIP+4 is cut down to them by
 * {@link Geocoder#fiveDigitZip}. The contract accepts both spellings of the same postal code and
 * the extra four narrow it to a block — a distinction {@code zip_centroid} does not make and does
 * not need to.
 *
 * <p>The only {@link Geocoder} there is, and the only one there should be: it answers from a
 * table that is always there, which is what makes it safe on the write path.
 */
@Component
class ZipCentroidGeocoder implements Geocoder {

	private final CatalogZipRepository zips;

	ZipCentroidGeocoder(CatalogZipRepository zips) {
		this.zips = zips;
	}

	@Override
	@Transactional(readOnly = true)
	public Optional<Geocode> locate(PostalAddress address) {
		return Geocoder.fiveDigitZip(address.postalCode())
				.flatMap(zips::findById)
				.map(zip -> new Geocode(zip.toPoint(), GeocodePrecision.ZIP));
	}
}
