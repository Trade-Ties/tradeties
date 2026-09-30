package com.tradeties.business;

import java.time.DayOfWeek;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * The working week a business set for itself, for its public profile.
 *
 * <p><strong>Declared here and implemented in {@code availability}</strong>, like
 * {@link CalendarReadiness}, {@link NextAvailability} and {@link OpenSlots} and for the same
 * reason: that module already depends on this one to resolve which business a caller owns, so
 * depending back on it would close a cycle Spring Modulith rejects.
 *
 * <p>The week as declared, not the week as it will be: time off and accepted appointments are not
 * subtracted. A customer reading "Mondays 8–5" is reading when this business works, and which of
 * those hours are still free is what the calendar answers.
 */
public interface OpeningHours {

	/**
	 * One stretch of work as minutes since local midnight, half-open — the calendar's own
	 * {@code HoursBlock}, which this module cannot see. A day that runs to midnight ends at 1440.
	 */
	record Stretch(int startsAtMinutes, int endsAtMinutes) {
	}

	/**
	 * @return all seven days, Monday first, each with its stretches in order and empty for a day
	 *         off. A business that never set its week is closed every day, which is the same thing
	 *         to a customer
	 */
	Map<DayOfWeek, List<Stretch>> weekOf(UUID businessId);
}
