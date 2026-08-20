package com.tradeties.business.internal;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.tradeties.business.BusinessDetails;
import com.tradeties.business.BusinessStatus;
import com.tradeties.business.CalendarReadiness;
import com.tradeties.business.ProfileNotReadyException;
import com.tradeties.business.ProfileReadiness;
import com.tradeties.business.ProfileSuspendedException;
import com.tradeties.business.ReadinessCheck;
import com.tradeties.business.ReadinessCheckCode;
import com.tradeties.business.ServicePricingMode;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Onboarding step 9: the checklist, and the two moves it guards.
 *
 * <p>Every condition here reads from at least two tables, which is precisely why none of them
 * is a constraint (DATAMODEL section 13.4). The database holds what one row can decide; this
 * class holds what only the whole profile can.
 */
@Service
public class PublishService {

	private final BusinessProfileRepository businesses;
	private final BusinessTradeRepository trades;
	private final ServiceOfferingRepository services;
	private final BusinessPricingRepository pricing;
	private final CalendarReadiness calendar;

	PublishService(BusinessProfileRepository businesses,
			BusinessTradeRepository trades,
			ServiceOfferingRepository services,
			BusinessPricingRepository pricing,
			CalendarReadiness calendar) {

		this.businesses = businesses;
		this.trades = trades;
		this.services = services;
		this.pricing = pricing;
		this.calendar = calendar;
	}

	@Transactional(readOnly = true)
	public Optional<ProfileReadiness> findReadinessByOwner(UUID ownerUserId) {
		return businesses.findByOwnerUserId(ownerUserId).map(business -> evaluate(business.id()));
	}

	/**
	 * Re-running is not paranoia about the client: between the read that greyed out the button
	 * and this call, the same tradesperson can have deactivated their only service in another tab.
	 *
	 * <p>Already published is a no-op rather than an error.
	 *
	 * @throws ProfileSuspendedException if the profile is suspended, the same rule as on
	 *         {@link #unpublishForOwner} — publishing is the other way out of a suspension, and no
	 *         more the holder's to take
	 */
	@Transactional
	public Optional<BusinessDetails> publishForOwner(UUID ownerUserId) {
		Optional<BusinessProfile> found = businesses.findByOwnerUserId(ownerUserId);
		if (found.isEmpty()) {
			return Optional.empty();
		}

		BusinessProfile business = found.get();
		// Before the checklist, not after: a suspended profile that has since lost a service
		// would otherwise answer 422 with the checklist, which reads as "add one and you are
		// back online". The suspension is the reason, and it is the one to report.
		if (business.status() == BusinessStatus.SUSPENDED) {
			throw new ProfileSuspendedException();
		}
		if (business.status() == BusinessStatus.PUBLISHED) {
			return Optional.of(business.toDetails());
		}

		ProfileReadiness readiness = evaluate(business.id());
		if (!readiness.ready()) {
			throw new ProfileNotReadyException(readiness);
		}

		business.publish();
		return Optional.of(businesses.saveAndFlush(business).toDetails());
	}

	/**
	 * Accepted appointments are untouched — this is not a cancellation, and the customers who
	 * already hold a booking still hold one.
	 *
	 * @throws ProfileSuspendedException if the profile is suspended. That state is the
	 *         marketplace's, not the holder's, and leaving it is not theirs to do.
	 */
	@Transactional
	public Optional<BusinessDetails> unpublishForOwner(UUID ownerUserId) {
		Optional<BusinessProfile> found = businesses.findByOwnerUserId(ownerUserId);
		if (found.isEmpty()) {
			return Optional.empty();
		}

		BusinessProfile business = found.get();
		if (business.status() == BusinessStatus.SUSPENDED) {
			throw new ProfileSuspendedException();
		}
		if (business.status() == BusinessStatus.DRAFT) {
			return Optional.of(business.toDetails());
		}

		business.unpublish();
		return Optional.of(businesses.saveAndFlush(business).toDetails());
	}

	private ProfileReadiness evaluate(UUID businessId) {
		List<ServiceOffering> activeServices =
				services.findByBusinessIdAndActiveTrueOrderBySortOrderAscCreatedAtAsc(businessId);
		Optional<BusinessPricing> pricingTerms = pricing.findById(businessId);

		List<ReadinessCheck> checks = new ArrayList<>();

		checks.add(primaryTrade(businessId));
		checks.add(atLeastOneService(activeServices));
		checks.add(hourlyServicesHaveARate(activeServices, pricingTerms));
		checks.add(pricingSet(pricingTerms));
		checks.add(workingHoursSet(businessId));

		return new ProfileReadiness(checks);
	}

	private ReadinessCheck primaryTrade(UUID businessId) {
		long primaries = trades.countByIdBusinessIdAndPrimaryIsTrue(businessId);

		return primaries == 1
				? ReadinessCheck.passed(ReadinessCheckCode.PRIMARY_TRADE, "A main trade is chosen.")
				: ReadinessCheck.failed(ReadinessCheckCode.PRIMARY_TRADE,
						"Choose the one trade customers should find you under first.");
	}

	private ReadinessCheck atLeastOneService(List<ServiceOffering> activeServices) {
		return !activeServices.isEmpty()
				? ReadinessCheck.passed(ReadinessCheckCode.AT_LEAST_ONE_SERVICE, "You offer at least one service.")
				: ReadinessCheck.failed(ReadinessCheckCode.AT_LEAST_ONE_SERVICE,
						"Add at least one service. Its duration is what gives an appointment a length.");
	}

	private ReadinessCheck hourlyServicesHaveARate(List<ServiceOffering> activeServices,
			Optional<BusinessPricing> pricingTerms) {

		boolean generalRate = pricingTerms.map(BusinessPricing::hasHourlyRate).orElse(false);

		List<String> unpriced = activeServices.stream()
				.map(ServiceOffering::toDetails)
				.filter(service -> service.pricingMode() == ServicePricingMode.HOURLY)
				.filter(service -> service.price() == null)
				.map(com.tradeties.business.ServiceDetails::name)
				.toList();

		if (unpriced.isEmpty() || generalRate) {
			return ReadinessCheck.passed(ReadinessCheckCode.HOURLY_SERVICES_HAVE_A_RATE,
					"Every service billed by the hour has a rate.");
		}

		return ReadinessCheck.failed(ReadinessCheckCode.HOURLY_SERVICES_HAVE_A_RATE,
				"Set an hourly rate, or give one to each of these services: " + String.join(", ", unpriced));
	}

	private ReadinessCheck pricingSet(Optional<BusinessPricing> pricingTerms) {
		return pricingTerms.isPresent()
				? ReadinessCheck.passed(ReadinessCheckCode.PRICING_SET, "Your rates and terms are set.")
				: ReadinessCheck.failed(ReadinessCheckCode.PRICING_SET,
						"Set your rates and terms. A request records your cancellation fee when it is sent, "
								+ "so it cannot be sent without one.");
	}

	private ReadinessCheck workingHoursSet(UUID businessId) {
		return calendar.hasWorkingHours(businessId)
				? ReadinessCheck.passed(ReadinessCheckCode.WORKING_HOURS_SET, "Your working week is set.")
				: ReadinessCheck.failed(ReadinessCheckCode.WORKING_HOURS_SET,
						"Set your working hours. Without them you would be bookable and never have a free slot.");
	}
}
