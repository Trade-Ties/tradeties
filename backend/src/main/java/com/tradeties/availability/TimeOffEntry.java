package com.tradeties.availability;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * One stored entry, in the shape it was entered: days when {@code allDay}, otherwise a stretch
 * of hours — both on the clock of {@code timeZone}.
 */
public record TimeOffEntry(
		UUID id,
		boolean allDay,
		LocalDate firstDay,
		LocalDate lastDay,
		LocalDateTime startsAt,
		LocalDateTime endsAt,
		String timeZone,
		String note,
		long version) {
}
