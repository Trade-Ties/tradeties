package com.tradeties.business.internal;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Optional;
import java.util.UUID;

import com.tradeties.business.InvalidSelectionException;
import com.tradeties.business.OpenSlots;
import com.tradeties.business.Openings;
import com.tradeties.business.ServiceAvailability;
import com.tradeties.business.ServiceDetails;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The calendar behind a published profile, for one of its services.
 *
 * <p>Beside {@link PublicProfileService} and on the same rule: no token, no owner, and nothing in
 * the answer that identifies a person. It is the third customer-side read after the search and
 * the profile, and the first that needs both halves of the application — the service comes from
 * here and the diary from {@code availability}, through {@link OpenSlots}.
 *
 * <p><strong>The service is resolved before the calendar is walked</strong>, and not only to fail
 * fast. Its duration is what the walk cuts by, so a calendar drawn without it would be a calendar
 * of the wrong appointment — which is exactly the mistake the grid used to stand in for.
 */
@Service
public class PublicAvailabilityService {

	/**
	 * The widest stretch one question may cover.
	 *
	 * <p>A month, because a month is what a calendar shows. The far end is shortened rather than
	 * refused, so a client asking for a year is answered for the first month of it and told so —
	 * the alternative is a payload of some two thousand start times that nobody scrolls and every
	 * reader pays for.
	 */
	private static final int MOST_DAYS = 31;

	/**
	 * How many starts one answer carries at most.
	 *
	 * <p>Loose enough that a month of a quarter-hour grid over a normal working week fits inside
	 * it, so the cap is a guard against the unusual rather than a page size the client has to
	 * think about. When it does bite, {@code slotsCapped} says so rather than the answer quietly
	 * ending early.
	 */
	private static final int MOST_SLOTS = 750;

	private final BusinessSearchRepository businesses;
	private final ServiceOfferingRepository services;
	private final OpenSlots openSlots;

	PublicAvailabilityService(BusinessSearchRepository businesses,
			ServiceOfferingRepository services,
			OpenSlots openSlots) {

		this.businesses = businesses;
		this.services = services;
		this.openSlots = openSlots;
	}

	/**
	 * @param from the first day the customer asked for, in the business's own zone
	 * @param to the last day they asked for, inclusive. Shortened here to {@link #MOST_DAYS} and
	 *        again in {@code availability} to the booking horizon; what came of both is in the
	 *        answer
	 * @return empty for a slug nobody holds, for a draft and for a suspension — the same three
	 *         states the profile itself answers as one, because a calendar that existed for a
	 *         profile that does not would give the moderation decision away
	 * @throws InvalidSelectionException for a service this business does not offer or has
	 *         deactivated. Deliberately not an empty list: it can only come from a page that has
	 *         since gone stale, and "nobody is free" would send somebody to try another week
	 *         instead of reloading
	 */
	@Transactional(readOnly = true)
	public Optional<ServiceAvailability> find(String slug, UUID serviceId, LocalDate from, LocalDate to) {
		return businesses.findPublishedBySlug(slug).map(business -> {
			ServiceDetails service = services.findByIdAndBusinessId(serviceId, business.id())
					.filter(ServiceOffering::isActive)
					.map(ServiceOffering::toDetails)
					.orElseThrow(() -> new InvalidSelectionException(
							"This business does not offer a service " + serviceId));

			LocalDate furthest = from.plusDays(MOST_DAYS);
			Openings openings = openSlots.within(business.id(), ZoneId.of(business.timeZone()),
					from, to.isAfter(furthest) ? furthest : to,
					service.estimatedDurationMinutes(), MOST_SLOTS);

			return new ServiceAvailability(service.id(), business.timeZone(),
					service.estimatedDurationMinutes(),
					openings.from(), openings.to(), openings.starts(), openings.capped());
		});
	}
}
