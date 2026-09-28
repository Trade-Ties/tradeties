package com.tradeties.business.internal;

import java.util.Optional;

import com.tradeties.business.GeoPoint;
import com.tradeties.business.PostalAddress;
import com.tradeties.business.SiteLocations;

import org.springframework.stereotype.Service;

/**
 * Hands {@code job} the one geocoder that is safe on a write path.
 *
 * <p>Depends on {@link Geocoder} and not on {@link CensusGeocoder}, which is the whole reason
 * this class exists rather than the interface being made public: the other one answers from
 * somebody else's service and has an outcome — "could not ask" — that a save has nowhere to put.
 * Wiring it here would be a compile error, which is stronger than a comment asking nobody to.
 */
@Service
class SiteLocationsAdapter implements SiteLocations {

	private final Geocoder geocoder;

	SiteLocationsAdapter(Geocoder geocoder) {
		this.geocoder = geocoder;
	}

	@Override
	public Optional<GeoPoint> locate(PostalAddress address) {
		return geocoder.locate(address).map(Geocode::point);
	}
}
