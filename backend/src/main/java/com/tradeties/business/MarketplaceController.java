package com.tradeties.business;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import com.tradeties.business.internal.BusinessSearchService;
import com.tradeties.business.internal.PublicAvailabilityService;
import com.tradeties.business.internal.PublicProfileService;
import com.tradeties.business.internal.ServiceSuggestionService;
import com.tradeties.generated.api.MarketplaceApi;
import com.tradeties.generated.model.BusinessAvailability;
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
 *
 * <p>The catalogue suggestions are the newest entry and the one that reads least like the
 * others, so they are worth the re-check they ask for. Almost all of it is editorial content —
 * the jobs TradeTies has written names for, which are about nobody. The exception is
 * {@code offeredNearby}, and it is a yes or a no about a postal code rather than about a
 * business: it names none, counts none, and asking it repeatedly cannot narrow to one, because
 * the answer stops moving the moment a single tradesperson qualifies.
 */
@RestController
class MarketplaceController implements MarketplaceApi {

	private final BusinessSearchService search;
	private final PublicProfileService profiles;
	private final PublicAvailabilityService availability;
	private final ServiceSuggestionService suggestions;

	MarketplaceController(BusinessSearchService search, PublicProfileService profiles,
			PublicAvailabilityService availability, ServiceSuggestionService suggestions) {
		this.search = search;
		this.profiles = profiles;
		this.availability = availability;
		this.suggestions = suggestions;
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
			String zip, String job, String service, String name, Integer page) {

		return ResponseEntity.ok(toWire(search.search(zip, job, service, name, page)));
	}

	/**
	 * The other way into the same marketplace, and the one that does not guess.
	 *
	 * <p>{@code q} is never refused for being unfinished — a lone space or a comma answers 200
	 * with an empty list, because somebody mid-word has not made a mistake. The postal code still
	 * is refused when the Census does not list it, through the same
	 * {@code InvalidSelectionException} the search uses: the ZIP field is the only place on this
	 * operation where a customer can be wrong in a way worth telling them about.
	 */
	@Override
	public ResponseEntity<List<com.tradeties.generated.model.ServiceSuggestion>> suggestServices(
			String q, String zip) {

		return ResponseEntity.ok(suggestions.suggest(q, zip).stream()
				.map(MarketplaceController::toWire)
				.toList());
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

	/**
	 * The one window refused rather than shortened, and it is refused here rather than in the
	 * service because it is a statement about the request and not about the diary.
	 *
	 * <p>Every other way a window can be wrong has a nearest true answer — too far ahead is cut to
	 * the horizon, too soon is moved past the notice, too wide is cut to a month, and each of
	 * those comes back described in {@code from} and {@code to}. A window that ends before it
	 * begins has no nearest answer to be cut to, and no customer typed it: it takes two dates from
	 * a client that swapped them.
	 *
	 * <p>A missing profile still answers 404 and takes precedence over neither — the two are
	 * checked in the order they can be, and the dates are the only one this method holds.
	 */
	@Override
	public ResponseEntity<BusinessAvailability> getBusinessAvailability(
			UUID serviceId, LocalDate from, LocalDate to, String slug) {

		if (to.isBefore(from)) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
					"The window ends before it begins: " + from + " to " + to);
		}

		return ResponseEntity.ok(availability.find(slug, serviceId, from, to)
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

	/**
	 * The starts go out as instants at UTC, like the ones on a search result and for the same
	 * reason: {@code timeZone} beside them is what they are meant to be read in, and an offset
	 * baked into each one would be a second answer to that question — one that goes wrong twice a
	 * year, on the weekend a zone changes and the stored offset does not.
	 */
	private static BusinessAvailability toWire(ServiceAvailability availability) {
		return new BusinessAvailability()
				.serviceId(availability.serviceId())
				.timeZone(availability.timeZone())
				.appointmentMinutes(availability.appointmentMinutes())
				.from(availability.from())
				.to(availability.to())
				.slots(availability.slots().stream().map(slot -> slot.atOffset(ZoneOffset.UTC)).toList())
				.slotsCapped(availability.slotsCapped());
	}

	/** Percentages sit in {@code NUMERIC(5,2)}, so their canonical scale is two, not four. */
	private static String toWirePercent(BigDecimal percent) {
		return percent == null ? null : percent.setScale(2, RoundingMode.UNNECESSARY).toPlainString();
	}

	private static com.tradeties.generated.model.BusinessSearchResults toWire(BusinessSearchResults found) {
		return new com.tradeties.generated.model.BusinessSearchResults()
				.matchedService(found.matchedService() == null ? null
						: new com.tradeties.generated.model.ServiceJob()
								.id(found.matchedService().id())
								.code(found.matchedService().code())
								.label(found.matchedService().label())
								.tradeId(found.matchedService().tradeId()))
				.matchedTrades(found.matchedTrades().stream().map(MarketplaceController::toWire).toList())
				.results(found.results().stream().map(MarketplaceController::toWire).toList())
				.page(found.page())
				.pageSize(found.pageSize())
				.total(found.total())
				.totalCapped(found.totalCapped());
	}

	/**
	 * {@code offeredNearby} is passed through including its absence. Null here means no postal
	 * code was given, the contract leaves the property off the object for exactly that case, and
	 * turning it into {@code false} on the way out would answer a question nobody asked.
	 */
	private static com.tradeties.generated.model.ServiceSuggestion toWire(ServiceSuggestion suggestion) {
		return new com.tradeties.generated.model.ServiceSuggestion()
				.code(suggestion.code())
				.label(suggestion.label())
				.tradeCode(suggestion.tradeCode())
				.tradeDisplayName(suggestion.tradeDisplayName())
				.offeredNearby(suggestion.offeredNearby());
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
				// Passed through including its absence: null means no job was picked, and turning
				// that into false would answer a question nobody asked.
				.offersThisJob(result.offersThisJob())
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
