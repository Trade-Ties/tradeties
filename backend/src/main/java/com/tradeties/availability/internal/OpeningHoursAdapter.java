package com.tradeties.availability.internal;

import java.time.DayOfWeek;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.tradeties.availability.BookingRules;
import com.tradeties.availability.HoursBlock;
import com.tradeties.business.OpeningHours;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * The interface belongs to {@code business} and the implementation to this module, which is what
 * keeps the dependency pointing one way: {@code availability} already depends on
 * {@code business}, and the reverse would close a cycle.
 */
@Component
class OpeningHoursAdapter implements OpeningHours {

	private final WorkingHoursRepository hours;
	private final BookingPolicyRepository policies;

	OpeningHoursAdapter(WorkingHoursRepository hours, BookingPolicyRepository policies) {
		this.hours = hours;
		this.policies = policies;
	}

	@Override
	@Transactional(readOnly = true)
	public BookingTerms bookingOf(UUID businessId) {
		// The defaults are what the calendar walks with when no row was written, so they are the
		// true answer for such a business rather than a guess.
		BookingRules rules = policies.findById(businessId).map(BookingPolicyRow::toRules).orElse(BookingRules.defaults());
		return new BookingTerms(rules.minLeadTimeHours(), rules.bookingHorizonDays());
	}

	@Override
	@Transactional(readOnly = true)
	public Map<DayOfWeek, List<Stretch>> weekOf(UUID businessId) {
		Map<DayOfWeek, List<Stretch>> week = new EnumMap<>(DayOfWeek.class);
		for (DayOfWeek day : DayOfWeek.values()) {
			week.put(day, new ArrayList<>());
		}

		hours.findByBusinessId(businessId).stream()
				.sorted(Comparator.comparingInt((WorkingHoursRow row) -> row.toBlock().startsAtMinutes()))
				.forEach(row -> {
					HoursBlock block = row.toBlock();
					week.get(row.day()).add(new Stretch(block.startsAtMinutes(), block.endsAtMinutes()));
				});

		return week;
	}
}
