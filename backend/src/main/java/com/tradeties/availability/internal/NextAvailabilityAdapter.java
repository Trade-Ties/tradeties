package com.tradeties.availability.internal;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import com.tradeties.availability.AcceptedAppointments;
import com.tradeties.availability.BookedSpan;
import com.tradeties.availability.BookingRules;
import com.tradeties.availability.HoursBlock;
import com.tradeties.business.NextAvailability;
import com.tradeties.business.NextAvailability.Asked;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Three queries for a whole page of results, then arithmetic.
 *
 * <p>Batched rather than looped, because the caller is a search result list of up to fifty
 * businesses: asked one row at a time this would be a hundred and fifty round trips to draw one
 * page. The walk itself is in {@link FreeSlots} and reads nothing.
 */
@Component
class NextAvailabilityAdapter implements NextAvailability {

	private final WorkingHoursRepository hours;
	private final BookingPolicyRepository policies;
	private final TimeOffRepository absences;
	private final AcceptedAppointments accepted;

	NextAvailabilityAdapter(WorkingHoursRepository hours,
			BookingPolicyRepository policies,
			TimeOffRepository absences,
			AcceptedAppointments accepted) {

		this.hours = hours;
		this.policies = policies;
		this.absences = absences;
		this.accepted = accepted;
	}

	@Override
	@Transactional(readOnly = true)
	public Map<UUID, List<Instant>> nextSlots(Map<UUID, Asked> businesses, int perBusiness) {
		if (businesses.isEmpty()) {
			return Map.of();
		}

		// One reading of the clock for the whole page. Taken per business, two rows of the same
		// result could disagree about which slot is still far enough away to be offered.
		Instant now = Instant.now();
		Set<UUID> ids = businesses.keySet();

		Map<UUID, Map<DayOfWeek, List<HoursBlock>>> weeks = weeksOf(ids);
		Map<UUID, BookingRules> rules = rulesOf(ids);
		Map<UUID, List<FreeSlots.Absence>> away = awayOf(ids, now);
		Map<UUID, List<BookedSpan>> booked = accepted.endingAfter(ids, now);

		Map<UUID, List<Instant>> slots = new HashMap<>();
		businesses.forEach((businessId, asked) -> {
			Map<DayOfWeek, List<HoursBlock>> week = weeks.get(businessId);

			// No rows at all is onboarding step 7 not reached, which is a different statement from
			// "closed all week" — and both mean there is nothing to offer, so neither gets an
			// entry. The port documents a missing key and an empty list as the same answer.
			if (week != null) {
				BookingRules theirs = rules.getOrDefault(businessId, BookingRules.defaults());

				slots.put(businessId, FreeSlots.upcoming(week,
						theirs,
						// A card must not advertise an hour somebody already has. Same subtraction
						// as the profile's calendar makes, and it has to be the same or a customer
						// clicking through finds a different list on the other side.
						unavailable(away.get(businessId), booked.get(businessId), theirs),
						asked.zone(),
						now,
						asked.appointmentMinutes(),
						perBusiness));
			}
		});

		return slots;
	}

	/**
	 * Time off and accepted appointments as one list, the appointments widened by the travel time
	 * the business keeps between jobs.
	 */
	private static List<FreeSlots.Absence> unavailable(List<FreeSlots.Absence> away,
			List<BookedSpan> booked, BookingRules rules) {

		if (booked == null || booked.isEmpty()) {
			return away == null ? List.of() : away;
		}

		long buffer = rules.appointmentBufferMinutes();

		return Stream.concat(
				away == null ? Stream.of() : away.stream(),
				booked.stream().map(span -> new FreeSlots.Absence(
						span.startsAt().minus(buffer, ChronoUnit.MINUTES),
						span.endsAt().plus(buffer, ChronoUnit.MINUTES))))
				.toList();
	}

	/** Blocks sorted within each day, because the walk down a day trusts that order. */
	private Map<UUID, Map<DayOfWeek, List<HoursBlock>>> weeksOf(Set<UUID> ids) {
		Map<UUID, Map<DayOfWeek, List<HoursBlock>>> weeks = new HashMap<>();

		for (WorkingHoursRow row : hours.findByBusinessIdIn(ids)) {
			weeks.computeIfAbsent(row.businessId(), id -> new EnumMap<>(DayOfWeek.class))
					.computeIfAbsent(row.day(), day -> new ArrayList<>())
					.add(row.toBlock());
		}

		weeks.values().forEach(week -> week.values()
				.forEach(blocks -> blocks.sort(Comparator.comparingInt(HoursBlock::startsAtMinutes))));

		return weeks;
	}

	/**
	 * A business past step 7 but not step 8 has hours and no policy row. The defaults are the same
	 * real answer they are when the tradesperson reads their own rules back, and are exactly what
	 * the first write would provision.
	 */
	private Map<UUID, BookingRules> rulesOf(Set<UUID> ids) {
		return policies.findAllById(ids).stream()
				.collect(Collectors.toMap(BookingPolicyRow::businessId, BookingPolicyRow::toRules));
	}

	private Map<UUID, List<FreeSlots.Absence>> awayOf(Set<UUID> ids, Instant now) {
		return absences.findByBusinessIdInAndEndsAtAfter(ids, now).stream()
				.collect(Collectors.groupingBy(TimeOffRow::businessId,
						Collectors.mapping(row -> new FreeSlots.Absence(row.startsAt(), row.endsAt()),
								Collectors.toList())));
	}
}
