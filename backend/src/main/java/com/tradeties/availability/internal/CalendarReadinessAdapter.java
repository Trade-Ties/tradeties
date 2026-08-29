package com.tradeties.availability.internal;

import java.util.UUID;

import com.tradeties.business.CalendarReadiness;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * The interface belongs to {@code business} and the implementation to this module, which is what
 * keeps the dependency pointing one way: {@code availability} already depends on
 * {@code business}, and the reverse would close a cycle.
 */
@Component
class CalendarReadinessAdapter implements CalendarReadiness {

	private final WorkingHoursRepository hours;

	CalendarReadinessAdapter(WorkingHoursRepository hours) {
		this.hours = hours;
	}

	@Override
	@Transactional(readOnly = true)
	public boolean hasWorkingHours(UUID businessId) {
		return hours.existsByBusinessId(businessId);
	}
}
