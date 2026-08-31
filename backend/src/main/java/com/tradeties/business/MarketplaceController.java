package com.tradeties.business;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;

import com.tradeties.business.internal.BusinessSearchService;
import com.tradeties.business.internal.PublicProfileService;
import com.tradeties.generated.api.MarketplaceApi;
import com.tradeties.generated.model.PublicBusinessProfile;
import com.tradeties.generated.model.PublicLicense;
import com.tradeties.generated.model.PublicPricing;
import com.tradeties.generated.model.PublicService;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * The customer's half of the API, and the only part of it that takes no token.
 *
 * <p>Separate from {@link BusinessController} on purpose, and not because the file was getting
 * long. Every operation there resolves a business from the caller's token — the whole class is
 * built around "this is yours". Nothing here has a caller to resolve, so the two have opposite
 * shapes, and the DECISIONS rule that customers stay anonymous is easier to keep true when the
 * anonymous surface is one small class one can read end to end.
 *
 * <p>Nothing it returns identifies a person: a business name, a town, a distance, a slug, what
 * the work costs, what each service takes, the licences on file and a handful of start times.
 * The list has grown again and the property has not, which is the only thing about it worth
 * checking when it grows next. What has never been on it is the part that matters — no street,
 * no coordinates, no legal name, no phone and no email.
 */
@RestController
class MarketplaceController implements MarketplaceApi {

	private final BusinessSearchService search;
	private final PublicProfileService profiles;

	MarketplaceController(BusinessSearchService search, PublicProfileService profiles) {
		this.search = search;
		this.profiles = profiles;
	}

	/**
	 * The contract already refused a postal code of the wrong shape and a page out of range, so
	 * what arrives here is well-formed. What it may still be is a code the Census does not list,
	 * and that answers 400 through {@code InvalidSelectionException} — the same way an unknown
	 * state does on the other side of the API.
	 *
	 * <p>A page within those bounds but past the end of the results is not among them. It answers
	 * 200 with nothing on it, because the client asked a legal question about a list that exists
	 * and the count in the reply already says where the list ended.
	 */
	@Override
	public ResponseEntity<com.tradeties.generated.model.BusinessSearchResults> searchBusinesses(
			String zip, String job, String name, Integer page) {

		return ResponseEntity.ok(toWire(search.search(zip, job, name, page)));
	}

	/**
	 * One 404 for three states, and it is the answer rather than a shortcut. A slug nobody holds,
	 * a profile still in draft and one the marketplace has suspended are indistinguishable from
	 * out here on purpose — the same reasoning that makes someone else's resource read as missing
	 * on the owner side, applied to a rule about publishing instead of about ownership.
	 */
	@Override
	public ResponseEntity<PublicBusinessProfile> getBusinessBySlug(String slug) {

		return ResponseEntity.ok(profiles.findBySlug(slug)
				.map(MarketplaceController::toWire)
				.orElseThrow(MarketplaceController::noSuchProfile));
	}

	private static ResponseStatusException noSuchProfile() {
		return new ResponseStatusException(HttpStatus.NOT_FOUND, "No business is published under this address");
	}

	/**
	 * <strong>Read the omissions, not the fields.</strong> What makes this operation anonymous is
	 * everything {@link PublicProfile} does not carry, and the one thing that could undo it is a
	 * field added here later without that being re-read.
	 */
	private static PublicBusinessProfile toWire(PublicProfile profile) {
		TradeSelection trades = profile.trades();

		List<TradeOption> held = new ArrayList<>(trades.additional());
		if (trades.primary() != null) {
			held.addFirst(trades.primary());
		}

		return new PublicBusinessProfile()
				.slug(profile.slug())
				.displayName(profile.displayName())
				.description(profile.description())
				.websiteUrl(profile.websiteUrl())
				.city(profile.city())
				.state(profile.state())
				.timeZone(profile.timeZone())
				.trades(held.stream().map(ReferenceController::toWire).toList())
				.primaryTradeId(trades.primary() == null ? null : trades.primary().id())
				.services(profile.services().stream().map(MarketplaceController::toWire).toList())
				.pricing(toWire(profile.pricing()))
				.licenses(profile.licenses().stream().map(MarketplaceController::toWire).toList());
	}

	/**
	 * The same service the owner sees, minus the three fields that are only about editing it: the
	 * version to write back with, the sort order to move it by, and the active flag — every
	 * service here is active, because the inactive ones were never fetched.
	 */
	private static PublicService toWire(ServiceDetails details) {
		return new PublicService()
				.id(details.id())
				.tradeId(details.tradeId())
				.name(details.name())
				.description(details.description())
				.estimatedDurationMinutes(details.estimatedDurationMinutes())
				.pricingMode(com.tradeties.generated.model.ServicePricingMode.valueOf(details.pricingMode().name()))
				.price(toWire(details.price()));
	}

	private static PublicPricing toWire(PricingTerms terms) {
		return new PublicPricing()
				.currency(terms.currency())
				.hourlyRate(toWire(terms.hourlyRate()))
				.minimumBillableMinutes(terms.minimumBillableMinutes())
				.billingIncrementMinutes(terms.billingIncrementMinutes())
				.serviceCallFee(toWire(terms.serviceCallFee()))
				.serviceCallFeeWaivedIfHired(terms.serviceCallFeeWaivedIfHired())
				.travelFeeMode(com.tradeties.generated.model.TravelFeeMode.valueOf(terms.travelFeeMode().name()))
				.travelFlatFee(toWire(terms.travelFlatFee()))
				.travelRatePerMile(toWire(terms.travelRatePerMile()))
				.freeTravelRadiusMiles(terms.freeTravelRadiusMiles())
				.materialPricingMode(
						com.tradeties.generated.model.MaterialPricingMode.valueOf(terms.materialPricingMode().name()))
				.materialMarkupPercent(toWirePercent(terms.materialMarkupPercent()))
				.cancellationFee(toWire(terms.cancellationFee()))
				.cancellationNoticeHours(terms.cancellationNoticeHours());
	}

	/**
	 * {@code verified}, not {@code verifiedAt}: when TradeTies checked is the marketplace's own
	 * record, and whether it did is the whole of what a customer reads from it.
	 */
	private static PublicLicense toWire(LicenseDetails details) {
		return new PublicLicense()
				.state(details.state())
				.licenseNumber(details.licenseNumber())
				.licenseType(details.licenseType())
				.issuedOn(details.issuedOn())
				.expiresOn(details.expiresOn())
				.verified(details.verifiedAt() != null);
	}

	/** Percentages sit in {@code NUMERIC(5,2)}, so their canonical scale is two, not four. */
	private static String toWirePercent(BigDecimal percent) {
		return percent == null ? null : percent.setScale(2, RoundingMode.UNNECESSARY).toPlainString();
	}

	private static com.tradeties.generated.model.BusinessSearchResults toWire(BusinessSearchResults found) {
		return new com.tradeties.generated.model.BusinessSearchResults()
				.matchedTrades(found.matchedTrades().stream().map(MarketplaceController::toWire).toList())
				.results(found.results().stream().map(MarketplaceController::toWire).toList())
				.page(found.page())
				.pageSize(found.pageSize())
				.total(found.total())
				.totalCapped(found.totalCapped());
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
