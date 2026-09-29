package com.tradeties.availability;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * An entry as the business types it: on its own wall clock, turned into instants only once the
 * profile's zone is known.
 *
 * @param firstDay read when {@code allDay}, the first day away
 * @param lastDay  read when {@code allDay}, the last day away — included
 * @param startsAt read when not {@code allDay}
 * @param endsAt   read when not {@code allDay}
 */
public record TimeOffDraft(
		boolean allDay,
		LocalDate firstDay,
		LocalDate lastDay,
		LocalDateTime startsAt,
		LocalDateTime endsAt,
		String note) {
}
