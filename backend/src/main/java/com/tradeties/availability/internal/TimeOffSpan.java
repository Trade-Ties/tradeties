package com.tradeties.availability.internal;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;

import com.tradeties.availability.InvalidTimeOffException;
import com.tradeties.availability.TimeOffDraft;
import com.tradeties.availability.TimeOffEntry;

/**
 * An entry's stretch as instants, and back.
 *
 * <p>Whole days run from local midnight to the local midnight after the last day, so a day that
 * loses an hour to daylight saving is still a whole day away rather than one ending at 23:00.
 */
record TimeOffSpan(Instant startsAt, Instant endsAt) {

	/** Aimed at a mistyped year, not at a long absence: a sabbatical is two entries. */
	private static final Duration LONGEST = Duration.ofDays(366);

	static TimeOffSpan of(TimeOffDraft draft, ZoneId zone) {
		Instant startsAt;
		Instant endsAt;

		if (draft.allDay()) {
			if (draft.firstDay() == null || draft.lastDay() == null) {
				throw new InvalidTimeOffException("Name the first and the last day away.");
			}
			if (draft.lastDay().isBefore(draft.firstDay())) {
				throw new InvalidTimeOffException("The last day away can't be before the first.");
			}
			startsAt = draft.firstDay().atStartOfDay(zone).toInstant();
			endsAt = draft.lastDay().plusDays(1).atStartOfDay(zone).toInstant();
		} else {
			if (draft.startsAt() == null || draft.endsAt() == null) {
				throw new InvalidTimeOffException("Name when it starts and when it ends.");
			}
			startsAt = draft.startsAt().atZone(zone).toInstant();
			endsAt = draft.endsAt().atZone(zone).toInstant();
			if (!endsAt.isAfter(startsAt)) {
				throw new InvalidTimeOffException("The end has to be after the start.");
			}
		}

		if (Duration.between(startsAt, endsAt).compareTo(LONGEST) > 0) {
			throw new InvalidTimeOffException("One entry covers a year at most. Enter a longer absence as several.");
		}

		return new TimeOffSpan(startsAt, endsAt);
	}

	static TimeOffEntry describe(TimeOffRow row, ZoneId zone) {
		if (row.allDay()) {
			return new TimeOffEntry(row.id(), true,
					LocalDate.ofInstant(row.startsAt(), zone),
					LocalDate.ofInstant(row.endsAt(), zone).minusDays(1),
					null, null, zone.getId(), row.reason(), row.version());
		}

		return new TimeOffEntry(row.id(), false, null, null,
				LocalDateTime.ofInstant(row.startsAt(), zone),
				LocalDateTime.ofInstant(row.endsAt(), zone),
				zone.getId(), row.reason(), row.version());
	}
}
