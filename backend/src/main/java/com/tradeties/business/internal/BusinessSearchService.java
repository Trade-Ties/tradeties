package com.tradeties.business.internal;

import java.util.List;
import java.util.UUID;

import com.tradeties.business.BusinessSearchResult;
import com.tradeties.business.BusinessSearchResults;
import com.tradeties.business.GeoPoint;
import com.tradeties.business.InvalidSelectionException;
import com.tradeties.business.TradeMatch;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The customer's search: a postal code, a description of the problem, and nothing else.
 *
 * <p>Three steps, and the first two are the ones this application spent two slices building. The
 * postal code becomes a point through the same table that places every business, so both ends of
 * the distance are measured the same way. The description becomes a trade, because the customer
 * is never asked to pick one. What remains is a single query.
 */
@Service
public class BusinessSearchService {

	/**
	 * Stands in for the trade list when there is nothing to narrow by. Never read — the flag
	 * beside it is false — and present only because a native {@code IN ()} needs something.
	 */
	private static final List<UUID> NOTHING_TO_NARROW_BY = List.of(new UUID(0, 0));

	private final CatalogZipRepository zips;
	private final JobDescriptionMatcher matcher;
	private final BusinessSearchRepository businesses;

	BusinessSearchService(CatalogZipRepository zips,
			JobDescriptionMatcher matcher,
			BusinessSearchRepository businesses) {

		this.zips = zips;
		this.matcher = matcher;
		this.businesses = businesses;
	}

	/**
	 * @param postalCode where the customer is. ZIP or ZIP+4; the five digits are what the table is
	 *        keyed on
	 * @param jobDescription the problem in the customer's words, or null
	 * @throws InvalidSelectionException for a postal code the Census does not list. Deliberately
	 *         not an empty result: a typo and "nobody serves you" are different news, and the
	 *         second one told about the first is what makes somebody correct an address that was
	 *         right. The same answer {@code requireKnownState} gives for a state that does not
	 *         exist, for the same reason
	 */
	@Transactional(readOnly = true)
	public BusinessSearchResults search(String postalCode, String jobDescription, int limit) {
		GeoPoint origin = Geocoder.fiveDigitZip(postalCode)
				.flatMap(zips::findById)
				.map(CatalogZip::toPoint)
				.orElseThrow(() -> new InvalidSelectionException("No such ZIP code: " + postalCode));

		List<TradeMatch> matched = matcher.match(jobDescription);

		List<BusinessSearchResult> results = businesses
				.findServing(origin.latitude(), origin.longitude(),
						!matched.isEmpty(),
						matched.isEmpty() ? NOTHING_TO_NARROW_BY : matched.stream().map(TradeMatch::id).toList(),
						limit)
				.stream()
				.map(row -> new BusinessSearchResult(row.getSlug(), row.getDisplayName(), row.getCity(),
						row.getState(), row.getPrimaryTrade(), row.getDistanceMiles()))
				.toList();

		return new BusinessSearchResults(matched, results);
	}
}
