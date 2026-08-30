package com.tradeties.business;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.ZoneOffset;

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
 * <p>Nothing it returns identifies a person: a business name, a town, a distance, a slug, an
 * hourly rate, two licence flags and a handful of start times. The list has grown and the
 * property has not, which is the only thing about it worth checking when it grows again.
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
				.distanceMiles(result.distanceMiles())
				.timeZone(result.timeZone())
				.hourlyRate(toWire(result.hourlyRate()))
				.licensed(result.licensed())
				.licenseVerified(result.licenseVerified())
				.nextSlots(result.nextSlots().stream().map(slot -> slot.atOffset(ZoneOffset.UTC)).toList());
	}

	/**
	 * Money as a decimal string at the scale the column stores, which is what the contract asks
	 * for and the same shape the tradesperson's own side of the API sends. A rate that had been
	 * through a JSON number would be a rate that eventually disagrees with the invoice.
	 */
	private static String toWire(BigDecimal amount) {
		return amount == null ? null : amount.setScale(4, RoundingMode.UNNECESSARY).toPlainString();
	}
}
