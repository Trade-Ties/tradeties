package com.tradeties.availability.internal;

import java.time.DayOfWeek;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

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

	OpeningHoursAdapter(WorkingHoursRepository hours) {
		this.hours = hours;
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
