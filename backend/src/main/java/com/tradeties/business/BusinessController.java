package com.tradeties.business;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import com.tradeties.business.internal.BusinessService;
import com.tradeties.business.internal.LicenseService;
import com.tradeties.business.internal.PricingService;
import com.tradeties.business.internal.PublishService;
import com.tradeties.business.internal.ServiceCatalogService;
import com.tradeties.business.internal.TradeSelectionService;
import com.tradeties.generated.api.BusinessApi;
import com.tradeties.generated.model.Address;
import com.tradeties.generated.model.BusinessProfile;
import com.tradeties.generated.model.BusinessTrades;
import com.tradeties.generated.model.BusinessTradesRequest;
import com.tradeties.generated.model.Coordinates;
import com.tradeties.generated.model.CreateBusinessRequest;
import com.tradeties.generated.model.License;
import com.tradeties.generated.model.LicenseInput;
import com.tradeties.generated.model.LicenseUpdate;
import com.tradeties.generated.model.Pricing;
import com.tradeties.generated.model.PricingInput;
import com.tradeties.generated.model.Service;
import com.tradeties.generated.model.ServiceInput;
import com.tradeties.generated.model.ServiceOrder;
import com.tradeties.generated.model.ServiceUpdate;
import com.tradeties.generated.model.SlugAvailability;
import com.tradeties.generated.model.UpdateBusinessRequest;
import com.tradeties.identity.CurrentMarketplaceUser;
import com.tradeties.identity.MarketplaceUser;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * No method takes a business id, because the contract has no path that carries one — the business
 * is always the caller's, resolved from the token. That is why the usual "check the id belongs to
 * you" line is missing everywhere below: there is no id to check.
 */
@RestController
class BusinessController implements BusinessApi {

	private final CurrentMarketplaceUser currentMarketplaceUser;
	private final BusinessService businessService;
	private final TradeSelectionService tradeSelectionService;
	private final ServiceCatalogService serviceCatalogService;
	private final PricingService pricingService;
	private final LicenseService licenseService;
	private final PublishService publishService;

	BusinessController(CurrentMarketplaceUser currentMarketplaceUser,
			BusinessService businessService,
			TradeSelectionService tradeSelectionService,
			ServiceCatalogService serviceCatalogService,
			PricingService pricingService,
			LicenseService licenseService,
			PublishService publishService) {

		this.currentMarketplaceUser = currentMarketplaceUser;
		this.businessService = businessService;
		this.tradeSelectionService = tradeSelectionService;
		this.serviceCatalogService = serviceCatalogService;
		this.pricingService = pricingService;
		this.licenseService = licenseService;
		this.publishService = publishService;
	}

	/**
	 * 404 is the normal answer for a tradesperson who has not finished onboarding step 2.
	 * The wizard reads it as "start at step 1" rather than as a failure.
	 */
	@Override
	public ResponseEntity<BusinessProfile> getMyBusiness() {

		BusinessDetails details = businessService.findByOwner(currentUserId())
				.orElseThrow(BusinessController::noProfileYet);

		return ResponseEntity.ok(toWire(details));
	}

	@Override
	public ResponseEntity<BusinessProfile> createMyBusiness(CreateBusinessRequest request) {

		BusinessDetails created = businessService.create(requireTradesperson().id(), toInput(request));

		return ResponseEntity.status(HttpStatus.CREATED).body(toWire(created));
	}

	@Override
	public ResponseEntity<BusinessProfile> updateMyBusiness(UpdateBusinessRequest request) {

		BusinessDetails updated = businessService
				.replace(requireTradesperson().id(), request.getVersion(), toInput(request),
						Boolean.TRUE.equals(request.getTimeZoneChangeConfirmed()))
				.orElseThrow(BusinessController::noProfileYet);

		return ResponseEntity.ok(toWire(updated));
	}

	@Override
	public ResponseEntity<SlugAvailability> checkSlugAvailability(String slug) {

		return ResponseEntity.ok(new SlugAvailability()
				.slug(slug)
				.available(businessService.isSlugAvailableFor(requireTradesperson().id(), slug)));
	}

	@Override
	public ResponseEntity<BusinessTrades> getMyTrades() {

		return ResponseEntity.ok(toWire(tradeSelectionService.findByOwner(currentUserId())
				.orElseThrow(BusinessController::noProfileYet)));
	}

	@Override
	public ResponseEntity<BusinessTrades> setMyTrades(BusinessTradesRequest request) {

		TradeSelection selection = tradeSelectionService
				.replaceForOwner(requireTradesperson().id(), request.getPrimaryTradeId(), request.getAdditionalTradeIds())
				.orElseThrow(BusinessController::noProfileYet);

		return ResponseEntity.ok(toWire(selection));
	}

	@Override
	public ResponseEntity<List<Service>> listMyServices() {

		List<ServiceDetails> services = serviceCatalogService.findByOwner(currentUserId())
				.orElseThrow(BusinessController::noProfileYet);

		return ResponseEntity.ok(services.stream().map(BusinessController::toWire).toList());
	}

	@Override
	public ResponseEntity<Service> addMyService(ServiceInput input) {

		ServiceDetails created = serviceCatalogService
				.addForOwner(requireTradesperson().id(), toDefinition(input))
				.orElseThrow(BusinessController::noProfileYet);

		return ResponseEntity.status(HttpStatus.CREATED).body(toWire(created));
	}

	@Override
	public ResponseEntity<Service> replaceMyService(UUID serviceId, ServiceUpdate update) {

		ServiceDetails replaced = serviceCatalogService
				.replaceForOwner(requireTradesperson().id(), serviceId, update.getVersion(), toDefinition(update))
				.orElseThrow(BusinessController::noSuchService);

		return ResponseEntity.ok(toWire(replaced));
	}

	@Override
	public ResponseEntity<Void> removeMyService(UUID serviceId, Boolean unpublishConfirmed) {

		if (!serviceCatalogService.removeForOwner(requireTradesperson().id(), serviceId,
				Boolean.TRUE.equals(unpublishConfirmed))) {
			throw noSuchService();
		}

		return ResponseEntity.noContent().build();
	}

	@Override
	public ResponseEntity<List<Service>> reorderMyServices(ServiceOrder order) {

		List<ServiceDetails> reordered = serviceCatalogService
				.reorderForOwner(requireTradesperson().id(), order.getServiceIds())
				.orElseThrow(BusinessController::noProfileYet);

		return ResponseEntity.ok(reordered.stream().map(BusinessController::toWire).toList());
	}

	@Override
	public ResponseEntity<Pricing> getMyPricing() {

		return ResponseEntity.ok(toWire(pricingService.findByOwner(currentUserId())
				.orElseThrow(BusinessController::noPricingYet)));
	}

	@Override
	public ResponseEntity<Pricing> setMyPricing(PricingInput input) {

		PricingTerms stored = pricingService
				.setForOwner(requireTradesperson().id(), input.getVersion(), toDefinition(input))
				.orElseThrow(BusinessController::noProfileYet);

		return ResponseEntity.ok(toWire(stored));
	}

	@Override
	public ResponseEntity<List<License>> listMyLicenses() {

		List<LicenseDetails> held = licenseService.findByOwner(currentUserId())
				.orElseThrow(BusinessController::noProfileYet);

		return ResponseEntity.ok(held.stream().map(BusinessController::toWire).toList());
	}

	@Override
	public ResponseEntity<License> addMyLicense(LicenseInput input) {

		LicenseDetails created = licenseService
				.addForOwner(requireTradesperson().id(), toDefinition(input))
				.orElseThrow(BusinessController::noProfileYet);

		return ResponseEntity.status(HttpStatus.CREATED).body(toWire(created));
	}

	@Override
	public ResponseEntity<License> replaceMyLicense(UUID licenseId, LicenseUpdate update) {

		LicenseDetails replaced = licenseService
				.replaceForOwner(requireTradesperson().id(), licenseId, update.getVersion(), toDefinition(update))
				.orElseThrow(BusinessController::noSuchLicense);

		return ResponseEntity.ok(toWire(replaced));
	}

	@Override
	public ResponseEntity<Void> removeMyLicense(UUID licenseId) {

		if (!licenseService.removeForOwner(requireTradesperson().id(), licenseId)) {
			throw noSuchLicense();
		}

		return ResponseEntity.noContent().build();
	}

	@Override
	public ResponseEntity<com.tradeties.generated.model.ProfileReadiness> getMyProfileReadiness() {

		return ResponseEntity.ok(toWire(publishService.findReadinessByOwner(currentUserId())
				.orElseThrow(BusinessController::noProfileYet)));
	}

	@Override
	public ResponseEntity<BusinessProfile> publishMyBusiness() {

		BusinessDetails published = publishService.publishForOwner(requireTradesperson().id())
				.orElseThrow(BusinessController::noProfileYet);

		return ResponseEntity.ok(toWire(published));
	}

	@Override
	public ResponseEntity<BusinessProfile> unpublishMyBusiness() {

		BusinessDetails draft = publishService.unpublishForOwner(requireTradesperson().id())
				.orElseThrow(BusinessController::noProfileYet);

		return ResponseEntity.ok(toWire(draft));
	}

	/**
	 * The caller's local user id, which is what {@code owner_user_id} stores — never the WorkOS id
	 * (DECISIONS section 7). Someone with a valid token who never registered simply owns no
	 * business, so the lookup failing and the profile not existing are the same answer to the
	 * client.
	 */
	private UUID currentUserId() {
		return currentMarketplaceUser.resolve().map(MarketplaceUser::id).orElseThrow(BusinessController::noProfileYet);
	}

	private MarketplaceUser requireTradesperson() {
		return currentMarketplaceUser.requireTradesperson();
	}

	private static ResponseStatusException noProfileYet() {
		return new ResponseStatusException(HttpStatus.NOT_FOUND, "No business profile for this account yet");
	}

	/** Indistinguishable from someone else's service, deliberately — a 403 would confirm it exists. */
	private static ResponseStatusException noSuchService() {
		return new ResponseStatusException(HttpStatus.NOT_FOUND, "No such service in this business");
	}

	private static ResponseStatusException noPricingYet() {
		return new ResponseStatusException(HttpStatus.NOT_FOUND, "No rates have been set for this account yet");
	}

	private static Pricing toWire(PricingTerms terms) {
		return new Pricing()
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
				.cancellationNoticeHours(terms.cancellationNoticeHours())
				.version(terms.version());
	}

	private static PricingDefinition toDefinition(PricingInput input) {
		return new PricingDefinition(
				toDomain(input.getHourlyRate()),
				input.getMinimumBillableMinutes(),
				input.getBillingIncrementMinutes(),
				toDomain(input.getServiceCallFee()),
				Boolean.TRUE.equals(input.getServiceCallFeeWaivedIfHired()),
				TravelFeeMode.valueOf(input.getTravelFeeMode().name()),
				toDomain(input.getTravelFlatFee()),
				toDomain(input.getTravelRatePerMile()),
				input.getFreeTravelRadiusMiles(),
				MaterialPricingMode.valueOf(input.getMaterialPricingMode().name()),
				toDomain(input.getMaterialMarkupPercent()),
				toDomain(input.getCancellationFee()),
				input.getCancellationNoticeHours());
	}

	private static ResponseStatusException noSuchLicense() {
		return new ResponseStatusException(HttpStatus.NOT_FOUND, "No such licence on this business");
	}

	/**
	 * The domain and wire types share every simple name here, so the generated ones are
	 * spelled out. Importing them would shadow the module's own types in this very package.
	 */
	static com.tradeties.generated.model.ProfileReadiness toWire(ProfileReadiness readiness) {
		return new com.tradeties.generated.model.ProfileReadiness()
				.ready(readiness.ready())
				.checks(readiness.checks().stream().map(BusinessController::toWire).toList());
	}

	private static com.tradeties.generated.model.ReadinessCheck toWire(ReadinessCheck check) {
		return new com.tradeties.generated.model.ReadinessCheck()
				.code(com.tradeties.generated.model.ReadinessCheckCode.valueOf(check.code().name()))
				.passed(check.passed())
				.detail(check.detail());
	}

	private static License toWire(LicenseDetails details) {
		return new License()
				.id(details.id())
				.state(details.state())
				.licenseNumber(details.licenseNumber())
				.licenseType(details.licenseType())
				.issuedOn(details.issuedOn())
				.expiresOn(details.expiresOn())
				.verifiedAt(details.verifiedAt() == null ? null : details.verifiedAt().atOffset(ZoneOffset.UTC))
				.version(details.version());
	}

	private static LicenseDefinition toDefinition(LicenseInput input) {
		return new LicenseDefinition(
				input.getState(),
				required(input.getLicenseNumber(), "licenseNumber"),
				input.getLicenseType(),
				input.getIssuedOn(),
				input.getExpiresOn());
	}

	private static LicenseDefinition toDefinition(LicenseUpdate update) {
		return new LicenseDefinition(
				update.getState(),
				required(update.getLicenseNumber(), "licenseNumber"),
				update.getLicenseType(),
				update.getIssuedOn(),
				update.getExpiresOn());
	}

	/** Percentages sit in {@code NUMERIC(5,2)}, so their canonical scale is two, not four. */
	private static String toWirePercent(BigDecimal percent) {
		return percent == null ? null : percent.setScale(2, RoundingMode.UNNECESSARY).toPlainString();
	}

	private static BusinessTrades toWire(TradeSelection selection) {
		return new BusinessTrades()
				.primary(selection.primary() == null ? null : ReferenceController.toWire(selection.primary()))
				.additional(selection.additional().stream().map(ReferenceController::toWire).toList());
	}

	private static Service toWire(ServiceDetails details) {
		return new Service()
				.id(details.id())
				.tradeId(details.tradeId())
				.name(details.name())
				.description(details.description())
				.estimatedDurationMinutes(details.estimatedDurationMinutes())
				.pricingMode(com.tradeties.generated.model.ServicePricingMode.valueOf(details.pricingMode().name()))
				.price(toWire(details.price()))
				.active(details.active())
				.sortOrder(details.sortOrder())
				.version(details.version());
	}

	private static ServiceDefinition toDefinition(ServiceInput input) {
		return new ServiceDefinition(
				input.getTradeId(),
				required(input.getName(), "name"),
				input.getDescription(),
				input.getEstimatedDurationMinutes(),
				ServicePricingMode.valueOf(input.getPricingMode().name()),
				toDomain(input.getPrice()),
				input.getActive() == null || input.getActive());
	}

	private static ServiceDefinition toDefinition(ServiceUpdate update) {
		return new ServiceDefinition(
				update.getTradeId(),
				required(update.getName(), "name"),
				update.getDescription(),
				update.getEstimatedDurationMinutes(),
				ServicePricingMode.valueOf(update.getPricingMode().name()),
				toDomain(update.getPrice()),
				update.getActive() == null || update.getActive());
	}

	/**
	 * Money crosses the wire as a decimal string, never as a JSON number — those are IEEE-754
	 * doubles in the browser, and money that has been through a double eventually disagrees
	 * with the invoice. The contract's pattern guarantees this parses.
	 */
	private static BigDecimal toDomain(String amount) {
		return amount == null ? null : new BigDecimal(amount);
	}

	/**
	 * Always at the column's scale, so the same amount looks the same however it was obtained.
	 * Without this, an amount just written comes back as the client sent it ("195.00") while the
	 * same amount read back from PostgreSQL comes back as "195.0000" — one value, two spellings,
	 * and a client comparing strings sees a change that did not happen.
	 *
	 * <p>{@code UNNECESSARY} rather than a rounding mode: nothing with more than four decimals can
	 * get here. If that ever stops being true, failing is the right answer — quietly rounding money
	 * is not.
	 */
	private static String toWire(BigDecimal amount) {
		return amount == null ? null : amount.setScale(4, RoundingMode.UNNECESSARY).toPlainString();
	}

	/**
	 * Trims a required free-text value, and refuses one that was nothing but space.
	 *
	 * <p>{@code minLength: 1} in the contract stops the empty string, but bean validation counts
	 * characters and {@code " "} is one — so a single space walks past it and past {@code NOT NULL}
	 * into a column, and a profile whose display name is a space can be published.
	 *
	 * <p>Trimming belongs at the same edge: {@code " Acme Plumbing"} and {@code "Acme Plumbing"} are
	 * one name to everybody except the unique index.
	 */
	private static String required(String value, String field) {
		String trimmed = value.strip();
		if (trimmed.isEmpty()) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, field + " cannot be blank");
		}

		return trimmed;
	}

	private static BusinessInput toInput(CreateBusinessRequest request) {
		return new BusinessInput(
				request.getSlug(),
				required(request.getLegalName(), "legalName"),
				required(request.getDisplayName(), "displayName"),
				request.getDescription(),
				request.getWebsiteUrl(),
				request.getPhone(),
				request.getEmail(),
				toDomain(request.getAddress()),
				toDomain(request.getCoordinates()),
				request.getTimeZone(),
				request.getServiceRadiusMiles());
	}

	private static BusinessInput toInput(UpdateBusinessRequest request) {
		return new BusinessInput(
				request.getSlug(),
				required(request.getLegalName(), "legalName"),
				required(request.getDisplayName(), "displayName"),
				request.getDescription(),
				request.getWebsiteUrl(),
				request.getPhone(),
				request.getEmail(),
				toDomain(request.getAddress()),
				toDomain(request.getCoordinates()),
				request.getTimeZone(),
				request.getServiceRadiusMiles());
	}

	private static PostalAddress toDomain(Address address) {
		return new PostalAddress(
				required(address.getStreet1(), "street1"),
				address.getStreet2(),
				required(address.getCity(), "city"),
				address.getState(),
				address.getPostalCode());
	}

	/**
	 * Wire coordinates are {@code double} because JSON has nothing better; the column is
	 * {@code NUMERIC(9,6)}. Converting through {@link BigDecimal#valueOf(double)} keeps the
	 * decimal value the client actually sent rather than the binary approximation of it.
	 */
	private static GeoPoint toDomain(Coordinates coordinates) {
		if (coordinates == null) {
			return null;
		}

		return new GeoPoint(
				BigDecimal.valueOf(coordinates.getLatitude()),
				BigDecimal.valueOf(coordinates.getLongitude()));
	}

	private static BusinessProfile toWire(BusinessDetails details) {
		return new BusinessProfile()
				.slug(details.slug())
				.slugLocked(details.slugLocked())
				.legalName(details.legalName())
				.displayName(details.displayName())
				.description(details.description())
				.websiteUrl(details.websiteUrl())
				.phone(details.phone())
				.email(details.email())
				.address(toWire(details.address()))
				.coordinates(toWire(details.coordinates()))
				.timeZone(details.timeZone())
				.serviceRadiusMiles(details.serviceRadiusMiles())
				.status(toWire(details.status()))
				.onboardingCompletedStep(details.onboardingCompletedStep())
				.version(details.version());
	}

	private static Address toWire(PostalAddress address) {
		return new Address()
				.street1(address.street1())
				.street2(address.street2())
				.city(address.city())
				.state(address.state())
				.postalCode(address.postalCode());
	}

	private static Coordinates toWire(GeoPoint point) {
		if (point == null) {
			return null;
		}

		return new Coordinates()
				.latitude(point.latitude().doubleValue())
				.longitude(point.longitude().doubleValue());
	}

	/**
	 * Mapped by name, and the two enums are held in step by hand: a contract edit that renames a
	 * value surfaces here as an {@code IllegalArgumentException} at runtime, not as a failing build.
	 */
	private static com.tradeties.generated.model.BusinessStatus toWire(BusinessStatus status) {
		return com.tradeties.generated.model.BusinessStatus.valueOf(status.name());
	}
}
