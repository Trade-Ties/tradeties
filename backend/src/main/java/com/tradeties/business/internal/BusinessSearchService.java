package com.tradeties.business.internal;

import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import com.tradeties.business.BusinessSearchResult;
import com.tradeties.business.BusinessSearchResults;
import com.tradeties.business.GeoPoint;
import com.tradeties.business.InvalidSelectionException;
import com.tradeties.business.NextAvailability;
import com.tradeties.business.TradeMatch;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The customer's search: a postal code, a description of the problem, and nothing else.
 *
 * <p>Three steps, and the first two are the ones this application spent two slices building. The
 * postal code becomes a point through the same table that places every business, so both ends of
 * the distance are measured the same way. The description becomes a trade, because the customer
 * is never asked to pick one. What remains is a single query.
 *
 * <p>A name, when one is given, narrows that query further and needs no step of its own: it is
 * compared where it is stored, by letter groups rather than by meaning, which is the one question
 * a description cannot answer.
 *
 * <p>A fourth step joins the calendar to the answer. It is deliberately after the query and not
 * part of it: which businesses reach this postal code is a question about shapes and can be
 * indexed, while when each of them is next free is arithmetic over a working week, and folding
 * the second into the first would cost the index for no gain.
 *
 * <p><strong>One page, and only so many pages.</strong> The answer carries a slice rather than
 * everything that matched, and no more than {@code maxResults} can be reached at all. The two do
 * different work. The page size is what keeps the fourth step cheap — the calendar is walked for
 * the results on this page, not for every match — while the cap bounds the deepest offset and the
 * count, and says out loud that position 300 is not worth reaching.
 */
@Service
public class BusinessSearchService {

	/**
	 * Stands in for the trade list when there is nothing to narrow by. Never read — the flag
	 * beside it is false — and present only because a native {@code IN ()} needs something.
	 */
	private static final List<UUID> NOTHING_TO_NARROW_BY = List.of(new UUID(0, 0));

	/**
	 * How many start times each result carries. Three, because three is what a result card shows —
	 * a fourth would be walked out of somebody's calendar for nobody to read.
	 */
	private static final int SLOTS_PER_RESULT = 3;

	private final CatalogZipRepository zips;
	private final JobDescriptionMatcher matcher;
	private final BusinessSearchRepository businesses;
	private final NextAvailability availability;
	private final int pageSize;
	private final int maxResults;

	/**
	 * @param pageSize how many results a page carries, from {@code tradeties.search.page-size}
	 * @param maxResults how far into the list anybody may reach, from
	 *        {@code tradeties.search.max-results}. The contract declares {@code page}'s maximum as
	 *        this divided by the page size, and it is written there by hand — which is why the
	 *        offset is checked against the cap here as well, rather than trusted from the wire
	 */
	BusinessSearchService(CatalogZipRepository zips,
			JobDescriptionMatcher matcher,
			BusinessSearchRepository businesses,
			NextAvailability availability,
			@Value("${tradeties.search.page-size}") int pageSize,
			@Value("${tradeties.search.max-results}") int maxResults) {

		this.zips = zips;
		this.matcher = matcher;
		this.businesses = businesses;
		this.availability = availability;
		this.pageSize = pageSize;
		this.maxResults = maxResults;
	}

	/**
	 * @param postalCode where the customer is. ZIP or ZIP+4; the five digits are what the table is
	 *        keyed on
	 * @param jobDescription the problem in the customer's words, or null
	 * @param name part of a business name, or null. Blank and absent narrow the same nothing
	 * @param page which page to answer with, counting from 1. A page past the end is an empty
	 *        result and not a refusal — running off the end of a list that exists is not the
	 *        caller's mistake, and the count in the answer already said where the end was
	 * @throws InvalidSelectionException for a postal code the Census does not list. Deliberately
	 *         not an empty result: a typo and "nobody serves you" are different news, and the
	 *         second one told about the first is what makes somebody correct an address that was
	 *         right. The same answer {@code requireKnownState} gives for a state that does not
	 *         exist, for the same reason
	 */
	@Transactional(readOnly = true)
	public BusinessSearchResults search(String postalCode, String jobDescription, String name, int page) {
		GeoPoint origin = Geocoder.fiveDigitZip(postalCode)
				.flatMap(zips::findById)
				.map(CatalogZip::toPoint)
				.orElseThrow(() -> new InvalidSelectionException("No such ZIP code: " + postalCode));

		List<TradeMatch> matched = matcher.match(jobDescription);

		boolean narrowByTrade = !matched.isEmpty();
		List<UUID> tradeIds = matched.isEmpty()
				? NOTHING_TO_NARROW_BY
				: matched.stream().map(TradeMatch::id).toList();
		String narrowByName = name == null ? "" : name.trim();

		// One past the cap, so the answer can tell "exactly this many" from "more than we count".
		int counted = businesses.countServing(origin.latitude(), origin.longitude(),
				narrowByTrade, tradeIds, narrowByName, maxResults + 1);
		boolean totalCapped = counted > maxResults;
		int total = totalCapped ? maxResults : counted;

		// Never ask for a row beyond the cap, whatever the contract let through. The last page is
		// short when the cap is not a whole number of pages, and there is nothing at all past it.
		int offset = (page - 1) * pageSize;
		int wanted = Math.min(pageSize, maxResults - offset);

		if (wanted <= 0 || offset >= total) {
			return new BusinessSearchResults(matched, List.of(), page, pageSize, total, totalCapped);
		}

		List<BusinessSearchRepository.SearchRow> rows = businesses
				.findServing(origin.latitude(), origin.longitude(),
						narrowByTrade, tradeIds, narrowByName, wanted, offset);

		Map<UUID, List<Instant>> slots = availability.nextSlots(
				rows.stream().collect(Collectors.toMap(
						BusinessSearchRepository.SearchRow::getId,
						row -> ZoneId.of(row.getTimeZone()))),
				SLOTS_PER_RESULT);

		List<BusinessSearchResult> results = rows.stream()
				.map(row -> new BusinessSearchResult(row.getSlug(), row.getDisplayName(), row.getCity(),
						row.getState(), row.getPrimaryTrade(), row.getDistanceMiles(), row.getTimeZone(),
						row.getHourlyRate(), row.getLicensed(), row.getLicenseVerified(),
						slots.getOrDefault(row.getId(), List.of())))
				.toList();

		return new BusinessSearchResults(matched, results, page, pageSize, total, totalCapped);
	}
}
