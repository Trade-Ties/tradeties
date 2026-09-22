package com.tradeties.business.internal;

import java.math.BigDecimal;
import java.util.List;

import com.tradeties.business.GeoPoint;
import com.tradeties.business.InvalidSelectionException;
import com.tradeties.business.ServiceSuggestion;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The search box one keystroke at a time.
 *
 * <p>The counterpart to {@link JobDescriptionMatcher} and deliberately not an improvement on it.
 * That one reads a finished sentence and guesses a trade, which is the only thing that can be
 * done with prose nobody has seen before; this offers jobs the marketplace already has a name
 * for, so the customer picks instead of the server guessing. Both stay: whoever types past the
 * end of the catalogue still gets an answer.
 */
@Service
public class ServiceSuggestionService {

	/**
	 * How many jobs a dropdown under a text field can hold. Eight, because a ninth row is one
	 * nobody scrolls to — and because the list is read while somebody is still typing, so its job
	 * is to be scanned rather than studied.
	 */
	private static final int MOST_WORTH_SUGGESTING = 8;

	/**
	 * Stands in for the customer's location when they have not given one. Never read — the flag
	 * beside it is false — and present only because the query's parameters are not optional.
	 */
	private static final BigDecimal NOWHERE = BigDecimal.ZERO;

	/**
	 * How much of what somebody typed a job has to account for, as a share of the words in it,
	 * rounded up.
	 *
	 * <p>A floor rather than a filter on particular words. Half means one typed word still needs
	 * one match, while "is my the" needs two out of three and gets none — so filler on its own
	 * answers nothing without anybody having written "is" down as a word to ignore.
	 *
	 * <p>A constant and not a property yet, because nothing has asked for it to differ between
	 * environments. It is a share on purpose, so that when something does, it is a setting rather
	 * than a release.
	 *
	 * <p>Package-visible because the search asks the same question with it — "can the catalogue
	 * name this" has to mean the same thing there as it does here, or a description would be
	 * suggested against one bar and recorded as unnameable against another.
	 */
	static final double WORTH_CALLING_A_MATCH = 0.5;

	private final CatalogZipRepository zips;
	private final ServiceCatalogRepository catalogue;

	ServiceSuggestionService(CatalogZipRepository zips, ServiceCatalogRepository catalogue) {
		this.zips = zips;
		this.catalogue = catalogue;
	}

	/**
	 * @param typed what the customer has typed so far, partial words and all. Null, blank or
	 *        nothing but punctuation is an empty list rather than an error — somebody halfway
	 *        through a word has not made a mistake, and it is the one case this is asked about
	 *        most often
	 * @param postalCode where the customer is, or null if they have not said yet. Absent is not
	 *        an error either: the two fields are filled in whatever order suits them, and a
	 *        suggestion list that stays empty until an unrelated field is complete is a dead
	 *        search box
	 * @return best first, at most {@value #MOST_WORTH_SUGGESTING}, carrying
	 *         {@link ServiceSuggestion#offeredNearby()} only when a postal code was given
	 * @throws InvalidSelectionException for a postal code the Census does not list, which is what
	 *         the search answers for the same input. Answering an empty list instead would blame
	 *         the letters for a mistake in the ZIP field
	 */
	@Transactional(readOnly = true)
	public List<ServiceSuggestion> suggest(String typed, String postalCode) {
		if (typed == null || typed.isBlank()) {
			return List.of();
		}

		GeoPoint origin = origin(postalCode);

		return catalogue.suggest(typed, origin != null,
				origin == null ? NOWHERE : origin.latitude(),
				origin == null ? NOWHERE : origin.longitude(),
				WORTH_CALLING_A_MATCH, MOST_WORTH_SUGGESTING).stream()
				.map(row -> new ServiceSuggestion(row.getCode(), row.getLabel(),
						row.getTradeCode(), row.getTradeDisplayName(), row.getOfferedNearby()))
				.toList();
	}

	/** Null for "they have not said", an exception for "that is not a ZIP". */
	private GeoPoint origin(String postalCode) {
		if (postalCode == null || postalCode.isBlank()) {
			return null;
		}

		return Geocoder.fiveDigitZip(postalCode)
				.flatMap(zips::findById)
				.map(CatalogZip::toPoint)
				.orElseThrow(() -> new InvalidSelectionException("No such ZIP code: " + postalCode));
	}
}
