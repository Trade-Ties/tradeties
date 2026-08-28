package com.tradeties.business.internal;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.tradeties.business.BusinessDetails;
import com.tradeties.business.BusinessStatus;
import com.tradeties.business.CalendarReadiness;
import com.tradeties.business.LiveProfileNotReadyException;
import com.tradeties.business.ProfileNotReadyException;
import com.tradeties.business.ProfileReadiness;
import com.tradeties.business.ProfileSuspendedException;
import com.tradeties.business.UnconfirmedUnpublishException;
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

	/**
	 * Whether a change about to be made could take this profile off the market — asked before it.
	 *
	 * <p>Only a live profile that currently passes the checklist has anything to lose: a draft is
	 * not bookable yet, and one already failing the checklist is already not being offered, so
	 * neither is made worse by the change. Pair it with {@link #requireStillBookable}.
	 */
	boolean isBookable(UUID businessId, BusinessStatus status) {
		return status == BusinessStatus.PUBLISHED && evaluate(businessId).ready();
	}

	/**
	 * Refuses the change just made if it has taken a live profile below the checklist.
	 *
	 * <p>Here rather than at each caller because more than one write can do it: giving up a trade
	 * takes the services filed under it, and deleting or deactivating the last service does the
	 * same thing by a shorter route. Every one of them owes the same guard, and a hand-rolled copy
	 * is the one that forgets a condition.
	 *
	 * <p>Called after every write the change makes, so the checklist reads the profile as it would
	 * stand. Throwing rolls the transaction back, which is what puts back whatever was removed.
	 *
	 * @param wasBookable what {@link #isBookable} answered before the change
	 * @throws LiveProfileNotReadyException if it was bookable and no longer is
	 */
	void requireStillBookable(UUID businessId, boolean wasBookable) {
		if (!wasBookable) {
			return;
		}

		ProfileReadiness after = evaluate(businessId);
		if (!after.ready()) {
			throw new LiveProfileNotReadyException(after);
		}
	}

	/**
	 * Takes the profile off the market when the change just made left it below the checklist, and
	 * declines to do it unasked.
	 *
	 * <p>The other answer to the question {@link #requireStillBookable} refuses outright, for the
	 * one change that is a deliberate removal rather than a side effect — see
	 * {@link UnconfirmedUnpublishException} for which change gets which.
	 *
	 * <p>Called after the write, so the checklist reads the profile as it would stand. Throwing
	 * rolls the transaction back, which is what puts the service and the status back.
	 *
	 * @param wasBookable what {@link #isBookable} answered before the change
	 * @param confirmed the holder's answer to "this takes your profile off the marketplace"
	 * @throws UnconfirmedUnpublishException if it was needed and not given
	 */
	void unpublishIfNoLongerBookable(BusinessProfile business, boolean wasBookable, boolean confirmed) {
		if (!wasBookable || evaluate(business.id()).ready()) {
			return;
		}
		if (!confirmed) {
			throw new UnconfirmedUnpublishException();
		}

		business.unpublish();
		businesses.saveAndFlush(business);
	}

	/**
	 * Package-private rather than private: the two guards above are asked around another service's
	 * change, and a second copy of these five conditions is the copy that goes stale.
	 */
	ProfileReadiness evaluate(UUID businessId) {
		List<ServiceOffering> activeServices =
				services.findByBusinessIdAndActiveTrueOrderBySortOrderAscCreatedAtAsc(businessId);
		Optional<BusinessPricing> pricingTerms = pricing.findById(businessId);

		List<ReadinessCheck> checks = new ArrayList<>();

		checks.add(addressGeocoded(businessId));
		checks.add(primaryTrade(businessId));
		checks.add(atLeastOneService(activeServices));
		checks.add(hourlyServicesHaveARate(activeServices, pricingTerms));
		checks.add(pricingSet(pricingTerms));
		checks.add(workingHoursSet(businessId));

		return new ProfileReadiness(checks);
	}

	/**
	 * Read through the repository rather than passed in, because {@link #evaluate} is reached from
	 * call sites that hold nothing but the id. Inside a read-only transaction that has already
	 * loaded this row, which every one of them is, it is served from the persistence context.
	 *
	 * <p>The wording names the postal code, since that is the only field a tradesperson can act
	 * on: the geocoder reads nothing else, and "check your address" would send them re-reading a
	 * street name that was never consulted.
	 *
	 * <p>It is also the only detail on this list that is read out twice — the checklist shows it,
	 * and {@link LiveProfileNotReadyException} composes it into the sentence that refuses an
	 * address edit on a live profile. One string, so the two cannot come to disagree.
	 */
	private ReadinessCheck addressGeocoded(UUID businessId) {
		boolean located = businesses.findById(businessId)
				.map(BusinessProfile::hasCoordinates)
				.orElse(false);

		return located
				? ReadinessCheck.passed(ReadinessCheckCode.ADDRESS_GEOCODED, "Your address is on the map.")
				: ReadinessCheck.failed(ReadinessCheckCode.ADDRESS_GEOCODED,
						"We're unable to locate this ZIP code.");
	}

	private ReadinessCheck primaryTrade(UUID businessId) {
		long primaries = trades.countByIdBusinessIdAndPrimaryIsTrueAndDeletedAtIsNull(businessId);

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
