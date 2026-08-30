package com.tradeties.business;

import com.tradeties.business.internal.BusinessSearchService;
import com.tradeties.generated.api.MarketplaceApi;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

/**
 * The customer's half of the API, and the only part of it that takes no token.
 *
 * <p>Separate from {@link BusinessController} on purpose, and not because the file was getting
 * long. Every operation there resolves a business from the caller's token — the whole class is
 * built around "this is yours". Nothing here has a caller to resolve, so the two have opposite
 * shapes, and the DECISIONS rule that customers stay anonymous is easier to keep true when the
 * anonymous surface is one small class one can read end to end.
 *
 * <p>Nothing it returns identifies a person: a business name, a town, a distance and a slug.
 */
@RestController
class MarketplaceController implements MarketplaceApi {

	private final BusinessSearchService search;

	MarketplaceController(BusinessSearchService search) {
		this.search = search;
	}

	/**
	 * The contract already refused a postal code of the wrong shape and a limit out of range, so
	 * what arrives here is well-formed. What it may still be is a code the Census does not list,
	 * and that answers 400 through {@code InvalidSelectionException} — the same way an unknown
	 * state does on the other side of the API.
	 */
	@Override
	public ResponseEntity<com.tradeties.generated.model.BusinessSearchResults> searchBusinesses(
			String zip, String job, Integer limit) {

		return ResponseEntity.ok(toWire(search.search(zip, job, limit)));
	}

	private static com.tradeties.generated.model.BusinessSearchResults toWire(BusinessSearchResults found) {
		return new com.tradeties.generated.model.BusinessSearchResults()
				.matchedTrades(found.matchedTrades().stream().map(MarketplaceController::toWire).toList())
				.results(found.results().stream().map(MarketplaceController::toWire).toList());
	}

	private static com.tradeties.generated.model.TradeMatch toWire(TradeMatch match) {
		return new com.tradeties.generated.model.TradeMatch()
				.id(match.id())
				.code(match.code())
				.displayName(match.displayName())
				.score(match.score());
	}

	private static com.tradeties.generated.model.BusinessSearchResult toWire(BusinessSearchResult result) {
		return new com.tradeties.generated.model.BusinessSearchResult()
				.slug(result.slug())
				.displayName(result.displayName())
				.city(result.city())
				.state(result.state())
				.primaryTrade(result.primaryTrade())
				.distanceMiles(result.distanceMiles());
	}
}
